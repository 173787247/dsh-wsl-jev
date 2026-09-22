/** Best-effort redaction before sending state/questions to System One. */

const SENSITIVE_KEY =
  /^(password|passwd|secret|token|api[_-]?key|authorization|auth|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret)$/i;

const SECRET_SHAPES = [
  /\bBearer\s+[A-Za-z0-9._\-+/=]{20,}\b/gi,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bsk-or-[A-Za-z0-9_-]{20,}\b/g,
  /\bts_live_[A-Za-z0-9_-]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  /\bxapp-[A-Za-z0-9-]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function redactString(text) {
  let s = String(text ?? "");
  for (const re of SECRET_SHAPES) {
    s = s.replace(re, "[REDACTED]");
  }
  return s;
}

export function redactValue(value) {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : redactValue(v);
    }
    return out;
  }
  return value;
}

export function truncateChars(text, maxChars) {
  const s = String(text ?? "");
  const n = Number(maxChars);
  if (!Number.isFinite(n) || n <= 0 || s.length <= n) return s;
  return `${s.slice(0, n)}\n…[truncated ${s.length - n} chars]`;
}
