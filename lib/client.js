/**
 * System One HTTP client (OpenRouter or TypeSafe).
 * WSL: use HTTPS_PROXY via proxiedFetch (aligned with dsh-wsl-im/lib/proxy.js).
 */

import { redactValue, truncateChars } from "./redact.js";
import { proxiedFetch, proxyLabel, resolveProxyUrl } from "./proxy.js";

export const OPENROUTER_SYSTEMONE = "https://openrouter.ai/api/v1/systemone";
export const TYPESAFE_SYSTEMONE = "https://api.typesafe.ai/v1/systemone";

/**
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.env]
 * @param {string} [opts.provider] auto | openrouter | typesafe
 * @param {string} [opts.model]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.maxStateChars]
 * @param {typeof fetch} [opts.fetchImpl] test hook
 */
export function createJevClient(opts = {}) {
  const env = opts.env || process.env;
  const resolved = resolveProvider(opts.provider || env.DSH_JEV_PROVIDER || "auto", env);
  const model = String(opts.model || env.DSH_JEV_MODEL || "jev-latest").trim() || "jev-latest";
  const timeoutMs = positive(opts.timeoutMs, 15_000);
  const maxStateChars = positive(opts.maxStateChars, 16_000);
  const fetchImpl = opts.fetchImpl || defaultFetch;

  return {
    resolved,
    model,
    timeoutMs,
    maxStateChars,
    status() {
      const hasKey = Boolean(resolved.apiKey);
      return {
        ok: true,
        provider: resolved.provider,
        endpoint: resolved.endpoint,
        hasKey,
        model,
        proxy: Boolean(resolveProxyUrl(env)),
        proxyMode: proxyLabel(env),
        timeoutMs,
        maxStateChars,
        egress: hasKey ? "ON when tools called" : "blocked (no API key)",
        ready: hasKey,
        hint: hasKey
          ? null
          : "No API key — set OPENROUTER_API_KEY or TYPESAFE_API_KEY (see examples/dsh-wsl-jev.env.example). Tools stay registered but jev_ask/check/rank will refuse until a key is present.",
      };
    },
    async systemOne({ state, questions }) {
      if (!resolved.apiKey) {
        throw new Error(
          "dsh-wsl-jev: no API key — set OPENROUTER_API_KEY or TYPESAFE_API_KEY (see examples/dsh-wsl-jev.env.example)",
        );
      }
      if (!questions || typeof questions !== "object" || !Object.keys(questions).length) {
        throw new Error("dsh-wsl-jev: questions object is required");
      }

      const safeState = prepareState(state, maxStateChars);
      const safeQuestions = redactValue(questions);
      const body = {
        model,
        state: safeState,
        questions: safeQuestions,
      };

      const started = Date.now();
      const res = await fetchImpl(resolved.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resolved.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "HTTP-Referer": "https://github.com/173787247/dsh-wsl-jev",
          "X-OpenRouter-Title": "dsh-wsl-jev",
        },
        body: JSON.stringify(body),
        timeoutMs,
        env,
      });
      const latencyMs = Date.now() - started;
      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`dsh-wsl-jev: non-JSON response HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      if (!res.ok) {
        const err = json?.error?.message || json?.message || json?.error || text.slice(0, 200);
        throw new Error(`dsh-wsl-jev: HTTP ${res.status}: ${err}`);
      }
      return {
        ok: true,
        provider: resolved.provider,
        model: json.model || model,
        answers: json.answers || {},
        usage: json.usage || null,
        id: json.id || null,
        latencyMs,
      };
    },
  };
}

export function resolveProvider(provider, env = process.env) {
  const p = String(provider || "auto").toLowerCase().trim();
  const orKey = str(env.OPENROUTER_API_KEY);
  const tsKey = str(env.TYPESAFE_API_KEY || env.TYPESAFE_KEY);

  if (p === "openrouter") {
    return {
      provider: "openrouter",
      endpoint: OPENROUTER_SYSTEMONE,
      apiKey: orKey,
    };
  }
  if (p === "typesafe") {
    return {
      provider: "typesafe",
      endpoint: TYPESAFE_SYSTEMONE,
      apiKey: tsKey,
    };
  }
  // auto
  if (orKey) {
    return { provider: "openrouter", endpoint: OPENROUTER_SYSTEMONE, apiKey: orKey };
  }
  if (tsKey) {
    return { provider: "typesafe", endpoint: TYPESAFE_SYSTEMONE, apiKey: tsKey };
  }
  return { provider: "none", endpoint: OPENROUTER_SYSTEMONE, apiKey: "" };
}

function prepareState(state, maxStateChars) {
  if (state == null) return "";
  if (typeof state === "string") {
    return truncateChars(redactValue(state), maxStateChars);
  }
  const redacted = redactValue(state);
  const raw = JSON.stringify(redacted);
  return truncateChars(raw, maxStateChars);
}

/**
 * Default egress: proxiedFetch (honors HTTPS_PROXY) with AbortSignal timeout.
 * fetchImpl test hooks keep the same (url, opts) surface.
 */
async function defaultFetch(url, { method, headers, body, timeoutMs, env }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 15_000);
  try {
    const res = await proxiedFetch(
      url,
      {
        method: method || "GET",
        headers,
        body,
        signal: ctrl.signal,
      },
      env || process.env,
    );
    return res;
  } catch (e) {
    if (ctrl.signal.aborted) {
      throw new Error(`dsh-wsl-jev: timeout after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

function str(v) {
  return String(v ?? "").trim();
}

function positive(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
