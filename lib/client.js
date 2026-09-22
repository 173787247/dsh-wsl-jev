/**
 * System One HTTP client (OpenRouter or TypeSafe).
 * WSL: use HTTPS_PROXY via https-proxy-agent (Node fetch NODE_USE_ENV_PROXY is unreliable here).
 */

import https from "node:https";
import http from "node:http";
import { createRequire } from "node:module";
import { redactValue, truncateChars } from "./redact.js";

const require = createRequire(import.meta.url);

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
      return {
        ok: true,
        provider: resolved.provider,
        endpoint: resolved.endpoint,
        hasKey: Boolean(resolved.apiKey),
        model,
        proxy: Boolean(readProxy(env)),
        timeoutMs,
        maxStateChars,
        egress: resolved.apiKey ? "ON when tools called" : "blocked (no API key)",
      };
    },
    async systemOne({ state, questions }) {
      if (!resolved.apiKey) {
        throw new Error(
          "dsh-wsl-jev: set OPENROUTER_API_KEY or TYPESAFE_API_KEY (see examples/dsh-wsl-jev.env.example)",
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

function readProxy(env = process.env) {
  return str(env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy);
}

function defaultFetch(url, { method, headers, body, timeoutMs, env }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const proxy = readProxy(env || process.env);
    const payload = body == null ? null : Buffer.from(String(body), "utf8");
    const hdrs = { ...headers };
    if (payload) hdrs["Content-Length"] = String(payload.length);

    let req;
    if (proxy) {
      let agent;
      try {
        const { HttpsProxyAgent } = require("https-proxy-agent");
        agent = new HttpsProxyAgent(proxy);
      } catch (e) {
        reject(new Error(`dsh-wsl-jev: proxy agent failed: ${e?.message || e}`));
        return;
      }
      req = https.request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || 443,
          path: `${target.pathname}${target.search}`,
          method: method || "GET",
          headers: hdrs,
          agent,
          timeout: timeoutMs,
        },
        (res) => collect(res, resolve),
      );
    } else {
      const lib = target.protocol === "http:" ? http : https;
      req = lib.request(
        url,
        {
          method: method || "GET",
          headers: hdrs,
          timeout: timeoutMs,
        },
        (res) => collect(res, resolve),
      );
    }

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`dsh-wsl-jev: timeout after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function collect(res, resolve) {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    const buf = Buffer.concat(chunks);
    resolve({
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode || 0,
      async text() {
        return buf.toString("utf8");
      },
    });
  });
}

function str(v) {
  return String(v ?? "").trim();
}

function positive(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
