---
title: BACK-815.01 - 重扫心跳钉住终端末行
labels: [source, web-server, cli, windows]
created_date: 2026-10-28 15:15
updated_date: 2026-10-28 15:15
source_path: backlog/tasks/back-815.01 - Pin-rescan-heartbeat-to-terminal-bottom-line.md
---

# BACK-815.01 - 重扫心跳钉住终端末行

BACK-815 给 ContentStore 周期对账加了 `ContentStore periodic rescan completed at <ISO>` 心跳，但这条心跳在真实服务器里只会**不断追加**而不是原地刷新——它用裸 `\r\x1b[K` 覆写末行，默认自己独占终端底部，而 watcher 的 error/warn 与请求日志共享同一个终端，任何一行插进来就把覆写推到错误的行、旧心跳滞留在上面。

## 改了什么

| 文件 | 作用 |
|---|---|
| `src/utils/status-line.ts`（新） | `StatusLine` 单例：TTY 下用 `\r\x1b[K` 钉住末行，非 TTY 退化为普通一行（不含 ANSI）；`installStatusLineHooks()` 包裹 `console.log/error/warn`，任何其它日志先调 `lift()` 把状态行推进 scrollback 再打印，重入安全 |
| `src/core/content-store.ts` | 心跳改调 `statusLine.update(...)` |
| `src/server/index.ts` | `start()` 顶部装 hooks，`stop()` 里 `clear()` |
| `src/cli.ts` | `backlog browser` 在 winpty/Git Bash 下自动启用；`--status-line` / `--no-status-line` 作为显式覆盖 |
| `src/test/status-line.test.ts`（新） | 6 例：非 TTY 回退、强制原地重写、lift 不重复打印、clear |

`lift()` 自身有过一个重复打印 bug：原本重印状态行来「上移」，实际应只发一个 `\n` 落到状态行下方。

## 关键教训：winpty 检测不能全局做

Git Bash / MSYS2（mintty）把 node/bun 包在 winpty 里，真实支持 ANSI 的终端也报 `process.stdout.isTTY === false`，于是心跳走 `console.log` 分支堆叠。想用 `MSYSTEM`/`TERM` + stdout 非文件重定向来自动识别 winpty 是不安全的：这些标记在非交互/重定向运行里同样出现，而 `\x1b[6n` DSR 探针在 winpty 下拿不到回复（stdin 也是管道）——全局自动开启会把 ANSI 喷进 CI 日志、测试输出与 `> file` 捕获（BACK-815.01 自己的测试就曾误激活）。

最终方案把判定**收窄到 `backlog browser` 命令内**（Windows + `MSYSTEM`/`MSYS` + stdout 未重定向 + 非 CI），MCP 与直接 `server.start()` 走默认保守分支，日志保持干净。`BACKLOG_STATUS_LINE` 环境变量是底层契约（测试与边缘场景用）。

过程中出现过一次回退：用户先反馈「不加 flag 也能用」，临时 flag 被删掉后立刻退回堆叠——确认其交互式 Git Bash 确实 `isTTY === false`，于是 flag 以显式覆盖的身份回归。

## Related Concepts

- [[concepts/web-server]] — 服务器启动/停止与 ContentStore 周期对账所在层
- [[concepts/cli-tui]] — CLI 终端输出与 TTY 差异处理

## Related Sources

- [[sources/back-815-server-cache-self-heal]] — 心跳的来源：指纹对账自愈
