---
title: BACK-558 - 浏览器服务器仅绑回环
labels: [source, server, security]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-558 - Bind-the-browser-server-to-loopback-only.md
---

# BACK-558 - 浏览器服务器仅绑回环

将浏览器服务器默认绑定从 `0.0.0.0` 改为 `127.0.0.1`，并为需要局域网访问的用户新增显式 `--host` 选项。

## 解决方案

- 在 `src/server/index.ts` 中新增 `BROWSER_HOST = 127.0.0.1`，并为 `BacklogServer.start(port, openBrowser, host)` 扩展 `host` 参数，默认回环。
- 在 `Bun.serve` 的 `serveOptions` 中设置 `hostname: host`。
- 回环绑定显示并打开熟悉的 `http://localhost:PORT` URL。
- 通配符（`0.0.0.0`）绑定打印具体局域网 IPv4 地址（通过 `os.networkInterfaces`）并警告 API 未认证；浏览器打开第一个具体局域网地址。
- 在 `src/cli.ts` 的 `backlog browser` 中新增 `--host <host>`（默认 `127.0.0.1`）。
- 端口可用性探测仍使用 `get-port@7.2.0`；其探测已覆盖通配符接口。
- 更新 README 与 CLI-INSTRUCTIONS，说明默认仅回环及 `--host` 按需启用。

## 验收标准

- 默认绑定为 `127.0.0.1`，显示并打开 `http://localhost:PORT`。
- `--host 0.0.0.0` 允许局域网访问，附带警告与具体局域网 URL。
- 测试覆盖默认回环、不打开浏览器、在 `127.0.0.1` 上 HTTP 200、通配符绑定及显式非回环主机。

## Related Concepts

- [[concepts/web-server]] — Web Server HTTP API 与浏览器启动

## Related Sources

- [[sources/back-559-browser-launch-honor-browser-env]] — BROWSER 环境变量启动
- [[sources/readme-md]] — README 回环文档
- [[sources/cli-instructions-md]] — CLI 参考中的回环文档
