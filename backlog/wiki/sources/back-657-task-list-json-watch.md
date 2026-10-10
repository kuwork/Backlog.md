---
title: BACK-657 - task list --json --watch 实时输出
labels: [source, cli, json-output, watch, upstream-migration]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-657 - Watch-task-lists-with-the-existing-JSON-output.md
---

# BACK-657 - task list --json --watch 实时输出

订阅方需要实时任务列表：一份完整的初始列表，以及本地状态变化时刷新的完整列表。本任务新增 `task list --json --watch`，按现有 JSON schema 精确流出——一条只有当前状态的流，不带事件包装、游标或逐变更事件。

- 任务列表动作被提取为 `runTaskList(options, emitJson = printJson)`（`src/cli.ts:2393`），让重复读取不会与一次性命令漂移：每次读取都重新校验选项、重新解析过滤、排序、限制、`--ready` 与仅本地范围；watch 路径只提供不同的输出汇
- 监视循环逐字节移植上游文件（`src/commands/watch-json.ts`）：在首次读取前挂上目录通知，发出完整 pretty-print 替换（与一次性 `--json` 逐字节一致），抑制未变化的字节，定期调和以挽回错过的通知，并在 SIGINT/SIGTERM、管道关闭、慢读取方或读取失败时有界关闭
- 本 fork 原先缺少的两个行为：首次响应后发现的重复任务身份现在经移植的 `duplicate-detection.ts` formatter 让 JSON 读取 fail-closed（碰撞文件名打到 stderr，退出码 1）；空 JSON 结果现在发出空 envelope 而不是 `No tasks found.`——循环绝不能把订阅方留在没有替换列表的状态
- 平台发现：Windows 上，cwd 为项目目录的被信号停止的子进程会让该目录在测试进程生命周期内永久无法删除（EBUSY），因此集成套件从仓库根运行 CLI 并经 `BACKLOG_CWD` 指向临时项目；被杀子进程的 stdout/stderr 永不报告结束，读取以 `process.exited` 收敛
- 文档落在这个 fork 真正被阅读的地方（上游的 JSON 小节锚点此处不存在）：`task list` 帮助 schema、`CLI-INSTRUCTIONS.md` 与发布的 overview/execution 指南——每个示例都点名带过滤的场景（某个 assignee 的实时队列），绝不出现裸的 list-all
- 验证：两个新套件先红（6/6 失败于 `unknown option '--watch'`），随后 49 + 104 用例转绿；另做真实 CLI 冒烟——实时帧与一次性读取逐字节一致，SIGTERM 以 143 退出且 stderr 为空

## 验收标准

- `task list --json --watch` 把完整初始列表写成一个 pretty-print JSON 文档，相同过滤条件下与一次性命令逐字节一致
- 变化时发出完整替换（含空 `tasks` 数组），未变化字节被抑制，错过的通知由定期调和挽回
- 过滤、排序、限制、`--ready` 与仅本地范围在每次读取时经与一次性命令相同的动作重新解析
- 重复身份让 JSON 读取 fail-closed；`--watch` 要求 `--json`，与 `--plain` 同用会被拒绝，非法输入在任何响应前被拒绝
- 信号、管道关闭、慢读取方与读取失败时关闭都有界

## Related Concepts

- [[concepts/json-output]] — 监视流原样复用的带版本 JSON 契约
- [[concepts/cli-instructions]] — 本 fork 中文档化监视契约的位置
- [[concepts/upstream-migration]] — 移植自上游 BACK-686（39912b864）
- [[concepts/json-watch]] — `task list --watch` 生命周期契约（流格式、启动活性、空闲 stat 签名）

## Related Sources

- [[sources/back-658-json-readiness-publication]] — 依赖：监视帧携带 BACK-658 新增的 `isReady` 字段
- [[sources/back-562-stable-json-output]] — 流与之逐字节一致的稳定 JSON 输出
- [[sources/back-538-duplicate-task-id-recovery]] — 重复身份处理；watch 现在对其 fail-closed
