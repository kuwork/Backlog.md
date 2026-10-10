---
title: BACK-716 - 状态机指引：静态章节与动态注入
labels: [source, agents, cli, mcp]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-716 - State-machine-guidance-static-overview-sections-dynamic-injection.md
---

# BACK-716 - 状态机指引：静态章节与动态注入

本任务让 AI 能读懂、使用并按需修改项目状态机，载体是 AI 本来就必读的三份 overview 文本（CLI `backlog instructions overview`、MCP 资源 `backlog://workflow/overview`、MCP 工具 `get_backlog_instructions` 无参数概览）。

## 实现要点

第一部分是静态章节：三份文本末尾追加同一节，描述 config.yml 中对象形式 statuses 的字段（name/category/exit/next[]/display）、旧式字符串数组的回退语义（末位为终态、归一化为 inprogress 的为 wip）、以及如何安全修改（整体写回不丢字段；无 CLI 命令设置 statuses，编辑走设置页编辑器或文件本身），章节末尾以 `{{STATE_MACHINE}}` 占位符（复用 `{{TASK_ID:n}}` 替换先例）留出动态渲染位置。CLI 文本将其放在"加载项目状态"处并吸收原有的 statuses/defaultStatus 段落，两份 MCP 文本因无 statuses 讨论而追加为末节。

第二部分是 doc-19 FR-8 的动态指引：新增 `StateMachine.describe()` 从配置只读渲染本项目的机器（状态/类别/exit 表、四个 ai 层级、每状态 next 边及 when/ai/if/requires/evidence、终态表、归档规则、由 ai 为 forbidden/propose 的边推导出的"停下等人工"清单），运行时由 `src/core/state-machine-guidance.ts` 把静态文本与渲染结果合成，服务到全部三个 overview 表面；不引入独立资源（`backlog://workflow/state-machine` 留给 M2）。渲染只陈述配置事实，不返回任何 allow/deny 结论（测试钉死 `Object.keys(machine)`），并按用户要求去掉了"声明但不强制"类的元评论。字符串数组项目按 AC-23 渲染"未声明迁移"说明而非层级表。

第三部分是把渲染结果注入项目自身的指引文件：`src/agent-instructions.ts` 新增 `state-machine` 标记（`<!-- BACKLOG.MD STATE MACHINE START/END -->`），幂等 strip-then-append，仅在文件已存在且已携带 Backlog 指引时刷新，触发点为 init、agents 及 Web 服务器的任何 statuses 写路径。韧性是另一关键：`parseStatusesConfig` 原本静默丢弃坏条目且读路径无任何诊断，新增 `inspectStatusesText()` 在丢弃发生处记录拒绝原因与位置，回退时渲染读者实际使用的机器（DEFAULT_STATUSES 并标注 fallback），describe() 在顶部渲染"配置问题"块，整个链路保证 overview 永不因坏配置而丢失。

后续轮次还补齐了"使用机器"的教学：静态章节在占位符前给出六步操作程序（读当前 status→找匹配 next 边→遵守 ai 层级→满足 evidence→写状态→"停下等人工"边不可单独走），task-execution 指南（CLI 与 MCP）改为"跟随本项目状态机而非固定序列"，MCP finalization 改为要求"机器声明的终态"而非写死 Done。

## Related Concepts

- [[concepts/mcp-workflow]] — overview 资源与 get_backlog_instructions 工具是 MCP 工作流指引的主要表面
- [[concepts/cli-instructions]] — CLI overview 与 instructions 命令是状态机指引的另一交付通道
- [[concepts/core-architecture]] — state-machine.ts 的 describe() 与 guidance 合成器是 core 层新增设施
- [[concepts/state-machine]] — describe() 渲染的对象形式状态机语义与 ai 四层权限所属概念

## Related Sources

- [[sources/back-715-state-machine-editor-settings]] — 上游任务：提供写入 statuses 的设置页编辑器与 state-machine.ts 编译器
- [[sources/back-718-task-help-workflow-overview-hint]] — 下游任务：把 --help 指向本任务增强的 workflow overview
- [[sources/back-582-agent-first-round-load-config]] — overview "required first read" 定位与首轮配置加载要求的来源
