---
title: BACK-822 - 状态机不再注入 agent 指令文件
labels: [source, cli, agent-guidance]
created_date: 2026-10-28 15:18
updated_date: 2026-10-28 15:18
source_path: backlog/tasks/back-822 - Remove-state-machine-injection-from-agent-instruction-files.md
---

# BACK-822 - 状态机不再注入 agent 指令文件

项目状态机早已以 `config.yml` 为唯一真源，CLI nudge 也已经让 agent 按需用 `backlog instructions overview` 去读。但 `backlog init` 等三个入口仍把渲染后的机器复制进 `AGENTS.md`/`CLAUDE.md`/`GEMINI.md`，成为一个 `state-machine` marker 块——配置数据被复制一份，还得靠服务端刷新才能不漂移。

## 改了什么

| 位置 | 处理 |
|---|---|
| `src/agent-instructions.ts` | `addAgentInstructions` 去掉 `stateMachineSection` 参数与三处 `applyStateMachineSection` 调用；改为 `stripGuidelineSection(finalContent, "state-machine").content`，**只剥不写** |
| 同上 | 删除死代码 `applyStateMachineSection` / `hasStateMachineGuidelines` / `refreshStateMachineInAgentInstructions` |
| `src/core/init.ts`、`src/cli.ts`（`agents --update-instructions`） | 去掉导入与第 5 个参数 |
| `src/server/index.ts` | 删除 `refreshInjectedStateMachine` 方法与两处调用 |
| `src/index.ts` | 去掉导出 |
| `src/guidelines/cli-agent-nudge.md`、`AGENTS.md` | 指南列表补齐 `decisions`、`graph`、`memos`（此前 AGENTS.md 落后于源文件）；本仓库 AGENTS.md 的旧 block 一并剥离 |

`renderProjectStateMachine` **保留**：`backlog instructions` 与 MCP 资源仍按需渲染整台机器，被移除的只是「把渲染结果写进文件」这条镜像路径。

## 为什么不是只修 init

用户确认的口径是彻底移除：三个写入入口全删、死代码清掉、已初始化仓库（含本仓）的旧 block 由 `init` / `agents --update-instructions` 顺手剥掉。只堵 `init` 会让老仓库继续带着一份会漂移的副本，并且留下两个仍在写文件的入口。

## 遗留

`src/test/mcp-server.test.ts:326` 期望的 MCP 工具列表缺少 `memo_create/update/delete`（服务端在 `src/mcp/tools/memos/index.ts` 注册），是本次变更之前就存在的红，未在任务内处理。

## Related Concepts

- [[concepts/state-machine]] — 状态机语义与「说明书不是闸门」的定位
- [[concepts/cli-instructions]] — 指南列表与 nudge 的交付表面
- [[concepts/mcp-workflow]] — 按需渲染的 MCP 资源路径

## Related Sources

- [[sources/back-716-state-machine-guidance-overviews]] — 最初引入 marker 注入的任务
- [[sources/back-521.2]] — CLI nudge 与 init 默认路径
