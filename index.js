import { createJevClient } from "./lib/client.js";
import {
  buildAskQuestions,
  buildCheckQuestions,
  buildRankQuestions,
  resolveRankPick,
} from "./lib/tools.js";

export const name = "dsh-wsl-jev";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  if (config.enabled === false) {
    console.log("[dsh-wsl-jev] disabled");
    return;
  }

  const client = createJevClient({
    provider: config.provider,
    model: config.model,
    timeoutMs: config.timeoutMs,
    maxStateChars: config.maxStateChars,
  });
  const st = client.status();
  console.log(
    `[dsh-wsl-jev] provider=${st.provider} endpoint=${st.endpoint} proxy=${st.proxy ? "on" : "off"} key=${st.hasKey ? "set" : "missing"} egress=${st.egress}`,
  );

  ctx.systemPrompt.section({
    name: "tool:jev",
    order: 127,
    text: [
      "dsh-wsl-jev calls TypeSafe Jev (System One): it returns noul/choice/score with confidence — it does NOT write prose or code.",
      "Use jev_status before first call if unsure about credentials.",
      "Use jev_ask for typed questions, jev_check to verify a claim against evidence, jev_rank to pick among candidates.",
      "Never paste API keys into chat or tool arguments.",
    ].join(" "),
  });

  const timeoutMs = client.timeoutMs;

  ctx.tools.register({
    name: "jev_status",
    description: "Show dsh-wsl-jev provider, endpoint, whether an API key is set, and proxy status (no secrets).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_a, v) => [{ type: "text", text: formatStatus(v) }],
    },
    timeoutMs: 5_000,
    isConcurrencySafe: () => true,
    async execute() {
      return client.status();
    },
    presentCall: () => ({ card: "generic", title: "Jev status" }),
    presentResult: (_a, r) => ({ card: "generic", title: "Jev status", content: r.content }),
  });

  ctx.tools.register({
    name: "jev_ask",
    description:
      "Ask Jev typed questions about a state. Each question is noul (yes/no), choice, or score. Returns answers with confidence — not prose.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["state", "questions"],
      properties: {
        state: {
          type: "string",
          description: "Context to evaluate (string). Keep under ~16k chars.",
        },
        questions: {
          type: "array",
          description: "Typed questions with id, type (noul|choice|score), instructions, criteria.",
          items: {
            type: "object",
            additionalProperties: true,
            required: ["id", "type", "instructions"],
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: ["noul", "choice", "score"] },
              instructions: { type: "string" },
              criteria: {},
              true: { type: "string" },
              false: { type: "string" },
            },
          },
        },
      },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_a, v) => [{ type: "text", text: formatResult(v) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        const questions = buildAskQuestions(args);
        return await client.systemOne({ state: args.state, questions });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "Jev ask" }),
    presentResult: (_a, r) => ({ card: "generic", title: "Jev ask", content: r.content }),
  });

  ctx.tools.register({
    name: "jev_check",
    description: "Ask Jev whether a claim is supported by evidence (single noul). Not for open-ended reasoning.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["claim"],
      properties: {
        claim: { type: "string" },
        evidence: { type: "string", description: "Optional supporting text" },
      },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_a, v) => [{ type: "text", text: formatResult(v) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        const questions = buildCheckQuestions(args);
        const state = [args.claim, args.evidence].filter(Boolean).join("\n\n");
        const out = await client.systemOne({ state, questions });
        return { ...out, claim: args.claim };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "Jev check" }),
    presentResult: (_a, r) => ({ card: "generic", title: "Jev check", content: r.content }),
  });

  ctx.tools.register({
    name: "jev_rank",
    description: "Ask Jev which candidate best matches a query (choice). Returns pick key, text, confidence.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query", "candidates"],
      properties: {
        query: { type: "string" },
        candidates: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 32,
        },
      },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_a, v) => [{ type: "text", text: formatResult(v) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        const questions = buildRankQuestions(args);
        const out = await client.systemOne({ state: args.query, questions });
        const pick = resolveRankPick(out.answers, args.candidates);
        return { ...out, pick, candidates: args.candidates };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "Jev rank" }),
    presentResult: (_a, r) => ({ card: "generic", title: "Jev rank", content: r.content }),
  });
}

function formatStatus(v) {
  if (!v?.ok && v?.error) return `jev_status FAIL: ${v.error}`;
  const lines = [
    v.ready === false ? "jev_status OK (not ready — no API key)" : "jev_status OK",
    `provider=${v.provider}`,
    `endpoint=${v.endpoint}`,
    `model=${v.model}`,
    `hasKey=${v.hasKey}`,
    `proxy=${v.proxy}`,
    `proxyMode=${v.proxyMode || "-"}`,
    `egress=${v.egress}`,
  ];
  if (v.hint) lines.push(`hint: ${v.hint}`);
  return lines.join("\n");
}

function formatResult(v) {
  if (!v?.ok) return `jev FAIL: ${v?.error || "unknown"}`;
  const lines = [
    `jev OK provider=${v.provider} model=${v.model} latencyMs=${v.latencyMs}`,
  ];
  if (v.pick) lines.push(`pick=${v.pick.text ?? v.pick.key} confidence=${v.pick.confidence ?? "?"}`);
  if (v.answers) lines.push(`answers=${JSON.stringify(v.answers)}`);
  if (v.usage) lines.push(`usage=${JSON.stringify(v.usage)}`);
  return lines.join("\n");
}
