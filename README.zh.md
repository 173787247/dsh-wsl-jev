# dsh-wsl-jev

> **安装集：** [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit) 可选伴侣，不在 `KIT_SET=daily` / `install.sh`�?

DeepSeek Harness WSL 插件：调�?**TypeSafe Jev**（System One）做结构化判断（`noul` / `choice` / `score`），**不生成长�?*�?

**自建、零第三�?Jev 插件依赖�?* 直接�?OpenRouter �?TypeSafe HTTP�?

[English �?README.md](./README.md)

## 链路

```mermaid
flowchart LR
  agent["dsh agent"] --> tools["jev_ask / check / rank"]
  tools --> plugin["dsh-wsl-jev"]
  plugin -->|"HTTPS_PROXY"| api["OpenRouter �?TypeSafe /v1/systemone"]
```

## 工具

| 工具 | 作用 |
|------|------|
| `jev_status` | �?provider / endpoint / 是否�?key / 代理 |
| `jev_ask` | �?`state` 提若�?typed 问题 |
| `jev_check` | 单题 noul：证据是否支�?claim |
| `jev_rank` | 从候选里选最�?query 的一�?|

## 凭证

优先 `OPENROUTER_API_KEY`，否�?`TYPESAFE_API_KEY`。可放进 `~/.dsh/dsh-wsl-jev.env`（kit �?`restart-dsh-web.sh` �?source）。WSL 需 `HTTPS_PROXY`�?

## 安装

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-jev
bash �?dsh-wsl-kit/scripts/restart-dsh-web.sh
```

新会话：`jev_status` �?`jev_check`�?

## License

MIT
