import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redactString, redactValue } from "../lib/redact.js";
import { createJevClient, resolveProvider, OPENROUTER_SYSTEMONE, TYPESAFE_SYSTEMONE } from "../lib/client.js";
import {
  buildAskQuestions,
  buildCheckQuestions,
  buildRankQuestions,
  resolveRankPick,
} from "../lib/tools.js";

describe("redact", () => {
  it("strips bearer and sk shapes", () => {
    assert.match(redactString("Bearer abcdefghijklmnopqrstuvwxyz012345"), /REDACTED/);
    assert.match(redactString("key sk-abcdefghijklmnopqrstuv"), /REDACTED/);
  });
  it("redacts sensitive object keys", () => {
    const out = redactValue({ apiKey: "secret", note: "ok" });
    assert.equal(out.apiKey, "[REDACTED]");
    assert.equal(out.note, "ok");
  });
});

describe("resolveProvider", () => {
  it("prefers OpenRouter in auto", () => {
    const r = resolveProvider("auto", { OPENROUTER_API_KEY: "or", TYPESAFE_API_KEY: "ts" });
    assert.equal(r.provider, "openrouter");
    assert.equal(r.endpoint, OPENROUTER_SYSTEMONE);
    assert.equal(r.apiKey, "or");
  });
  it("falls back to TypeSafe", () => {
    const r = resolveProvider("auto", { TYPESAFE_API_KEY: "ts" });
    assert.equal(r.provider, "typesafe");
    assert.equal(r.endpoint, TYPESAFE_SYSTEMONE);
  });
  it("none without keys", () => {
    const r = resolveProvider("auto", {});
    assert.equal(r.provider, "none");
    assert.equal(r.apiKey, "");
  });
});

describe("question builders", () => {
  it("builds ask noul/choice/score", () => {
    const q = buildAskQuestions({
      questions: [
        { id: "a", type: "noul", instructions: "ok?", true: "yes", false: "no" },
        { id: "b", type: "choice", instructions: "pick", criteria: { x: "X", y: "Y" } },
        { id: "c", type: "score", instructions: "how", criteria: ["low", "high"] },
      ],
    });
    assert.equal(q.a.type, "noul");
    assert.equal(q.b.type, "choice");
    assert.equal(q.c.type, "score");
  });
  it("builds check and rank", () => {
    const check = buildCheckQuestions({ claim: "sky is blue", evidence: "photo" });
    assert.equal(check.supported.type, "noul");
    const rank = buildRankQuestions({ query: "fast", candidates: ["a", "b", "c"] });
    assert.equal(rank.best.type, "choice");
    assert.equal(rank.best.criteria.c1, "b");
    const pick = resolveRankPick({ best: { choice: "c1", confidence: 0.9 } }, ["a", "b", "c"]);
    assert.equal(pick.text, "b");
  });
});

describe("createJevClient", () => {
  it("status reports missing key with friendly hint", () => {
    const c = createJevClient({ env: {}, provider: "auto" });
    const s = c.status();
    assert.equal(s.hasKey, false);
    assert.equal(s.provider, "none");
    assert.equal(s.ready, false);
    assert.match(s.hint, /OPENROUTER_API_KEY|TYPESAFE_API_KEY/);
    assert.equal(s.proxyMode, "direct");
  });
  it("errors without key on systemOne", async () => {
    const c = createJevClient({ env: {} });
    await assert.rejects(() => c.systemOne({ state: "x", questions: { a: { type: "noul", instructions: "y" } } }), /API key|API_KEY/);
  });
  it("posts body via fetchImpl", async () => {
    let seen;
    const c = createJevClient({
      env: { OPENROUTER_API_KEY: "test-key" },
      fetchImpl: async (url, opts) => {
        seen = { url, body: JSON.parse(opts.body), auth: opts.headers.Authorization };
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              model: "typesafe/jev-test",
              answers: { refund: { type: "noul", noul: 0.91 } },
              usage: { input_tokens: 10, output_tokens: 2 },
            });
          },
        };
      },
    });
    const out = await c.systemOne({
      state: "I was charged twice",
      questions: {
        refund: { type: "noul", instructions: "refund?", criteria: { true: "yes", false: "no" } },
      },
    });
    assert.equal(seen.url, OPENROUTER_SYSTEMONE);
    assert.equal(seen.auth, "Bearer test-key");
    assert.equal(seen.body.model, "jev-latest");
    assert.equal(seen.body.state, "I was charged twice");
    assert.equal(out.ok, true);
    assert.equal(out.answers.refund.noul, 0.91);
  });
});

describe("truncateChars", () => {
  it("truncates long strings", async () => {
    const { truncateChars } = await import("../lib/redact.js");
    assert.ok(truncateChars("abcdef", 4).startsWith("abcd"));
  });
});
