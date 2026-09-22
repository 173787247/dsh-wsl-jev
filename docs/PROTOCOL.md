# System One wire notes

`POST {base}/v1/systemone` with Bearer key.

| Provider | Base | Env |
|----------|------|-----|
| OpenRouter | `https://openrouter.ai/api` | `OPENROUTER_API_KEY` |
| TypeSafe | `https://api.typesafe.ai` | `TYPESAFE_API_KEY` |

Body: `{ model, state, questions }`. Answers: `noul` / `choice` / `score`.
This plugin does not speak chat completions.
