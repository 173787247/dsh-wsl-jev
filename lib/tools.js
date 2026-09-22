/** Build System One question objects for ask / check / rank. */

/**
 * @param {object} args
 * @param {Array<{id:string,type:string,instructions:string,criteria?:object|string[]}>} args.questions
 */
export function buildAskQuestions(args = {}) {
  const list = Array.isArray(args.questions) ? args.questions : [];
  if (!list.length) throw new Error("jev_ask: questions[] is required");
  const out = {};
  for (const q of list) {
    const id = String(q?.id || "").trim();
    if (!id) throw new Error("jev_ask: each question needs id");
    if (out[id]) throw new Error(`jev_ask: duplicate question id ${id}`);
    out[id] = normalizeQuestion(q);
  }
  return out;
}

export function buildCheckQuestions({ claim, evidence } = {}) {
  const c = String(claim || "").trim();
  if (!c) throw new Error("jev_check: claim is required");
  const ev = evidence == null ? "" : typeof evidence === "string" ? evidence : JSON.stringify(evidence);
  return {
    supported: {
      type: "noul",
      instructions: `Is the following claim supported by the evidence?\nClaim: ${c}${ev ? `\nEvidence:\n${ev}` : ""}`,
      criteria: {
        true: "The evidence supports the claim.",
        false: "The evidence does not support the claim, or evidence is missing.",
      },
    },
  };
}

export function buildRankQuestions({ query, candidates } = {}) {
  const q = String(query || "").trim();
  if (!q) throw new Error("jev_rank: query is required");
  const list = Array.isArray(candidates) ? candidates.map(String) : [];
  if (list.length < 2) throw new Error("jev_rank: need at least 2 candidates");
  if (list.length > 32) throw new Error("jev_rank: at most 32 candidates");
  const criteria = {};
  for (let i = 0; i < list.length; i++) {
    const key = `c${i}`;
    criteria[key] = list[i];
  }
  return {
    best: {
      type: "choice",
      instructions: `Which candidate best matches this query?\nQuery: ${q}`,
      criteria,
    },
  };
}

export function normalizeQuestion(q) {
  const type = String(q.type || "").toLowerCase().trim();
  const instructions = String(q.instructions || "").trim();
  if (!instructions) throw new Error("question instructions required");
  if (type === "noul" || type === "boolean") {
    const criteria =
      q.criteria && typeof q.criteria === "object" && !Array.isArray(q.criteria)
        ? q.criteria
        : {
            true: String(q.true || "Yes / true"),
            false: String(q.false || "No / false"),
          };
    return { type: "noul", instructions, criteria };
  }
  if (type === "choice") {
    const criteria = toCriteriaMap(q.criteria);
    if (Object.keys(criteria).length < 2) throw new Error("choice needs >=2 criteria");
    return { type: "choice", instructions, criteria };
  }
  if (type === "score") {
    const criteria = Array.isArray(q.criteria)
      ? q.criteria.map(String)
      : typeof q.criteria === "object" && q.criteria
        ? Object.values(q.criteria).map(String)
        : null;
    if (!criteria || criteria.length < 2) throw new Error("score needs ordered criteria[]");
    return { type: "score", instructions, criteria };
  }
  throw new Error(`unsupported question type: ${type || "(empty)"}`);
}

function toCriteriaMap(criteria) {
  if (Array.isArray(criteria)) {
    const out = {};
    criteria.forEach((c, i) => {
      out[`opt${i}`] = String(c);
    });
    return out;
  }
  if (criteria && typeof criteria === "object") {
    const out = {};
    for (const [k, v] of Object.entries(criteria)) out[k] = String(v);
    return out;
  }
  return {};
}

/** Map rank choice key back to candidate text. */
export function resolveRankPick(answers, candidates) {
  const pick = answers?.best;
  const key = pick?.choice ?? pick?.value ?? null;
  const list = Array.isArray(candidates) ? candidates.map(String) : [];
  if (key == null) return { key: null, text: null, confidence: pick?.confidence ?? null };
  const m = /^c(\d+)$/.exec(String(key));
  const idx = m ? Number(m[1]) : -1;
  return {
    key: String(key),
    text: idx >= 0 && idx < list.length ? list[idx] : null,
    confidence: pick?.confidence ?? null,
    raw: pick,
  };
}
