# Security

- API keys stay in process env (`OPENROUTER_API_KEY` / `TYPESAFE_API_KEY`). Do not put them in `cordis.patch.yml` or chat.
- `jev_*` tools send `state` / `questions` to OpenRouter or TypeSafe. Treat tool arguments as egress.
- Best-effort redaction runs before send; it cannot catch every secret shape.
- Report issues privately if they involve credential leakage.
