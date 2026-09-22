# dsh-wsl-jev

> **瀹夎闆嗭細** [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit) 鍙€変即渚ｏ紝涓嶅湪 `KIT_SET=daily` / `install.sh`銆?

DeepSeek Harness WSL 鎻掍欢锛氳皟鐢?**TypeSafe Jev**锛圫ystem One锛夊仛缁撴瀯鍖栧垽鏂紙`noul` / `choice` / `score`锛夛紝**涓嶇敓鎴愰暱鏂?*銆?

**鑷缓銆侀浂绗笁鏂?Jev 鎻掍欢渚濊禆銆?* 鐩存帴鎵?OpenRouter 鎴?TypeSafe HTTP銆?

[English 鈫?README.md](./README.md)

## 閾捐矾

```mermaid
flowchart LR
  agent["dsh agent"] --> tools["jev_ask / check / rank"]
  tools --> plugin["dsh-wsl-jev"]
  plugin -->|"HTTPS_PROXY"| api["OpenRouter 鎴?TypeSafe /v1/systemone"]
```

## 宸ュ叿

| 宸ュ叿 | 浣滅敤 |
|------|------|
| `jev_status` | 鐪?provider / endpoint / 鏄惁鏈?key / 浠ｇ悊 |
| `jev_ask` | 瀵?`state` 鎻愯嫢骞?typed 闂 |
| `jev_check` | 鍗曢 noul锛氳瘉鎹槸鍚︽敮鎸?claim |
| `jev_rank` | 浠庡€欓€夐噷閫夋渶璐?query 鐨勪竴椤?|

## 鍑瘉

浼樺厛 `OPENROUTER_API_KEY`锛屽惁鍒?`TYPESAFE_API_KEY`銆傚彲鏀捐繘 `~/.dsh/dsh-wsl-jev.env`锛坘it 鐨?`restart-dsh-web.sh` 浼?source锛夈€俉SL 闇€ `HTTPS_PROXY`銆?

## 瀹夎

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-jev
bash 鈥?dsh-wsl-kit/scripts/restart-dsh-web.sh
```

鏂颁細璇濓細`jev_status` 鈫?`jev_check`銆?

## License

MIT
