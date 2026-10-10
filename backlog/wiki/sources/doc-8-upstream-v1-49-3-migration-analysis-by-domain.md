---
title: doc-8 - 上游 v1.48.0→v1.49.3 迁移分析（按领域）
labels: [source, doc, migration, upstream]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/docs/migration/doc-8 - 上游任务迁移分析报告（v1.48.0-..-v1.49.3-按领域）.md
---

# doc-8 - 上游 v1.48.0→v1.49.3 迁移分析（按领域）

上游 `v1.48.0 .. v1.49.3` 变更的逐条详细分析，按领域与迁移建议组织。

分析要点：

- 覆盖 CLI/Core、TUI、Web、Server、Infra/CI 与 Nix 领域。
- 每个条目包含：核心目的、上游 merge commit/文件/变更量、与 fork 定制代码的交集风险、可复用部分、需排除/调整部分、优先级与迁移建议（① 直接复用 / ② 参考重写 / ③ 忽略）。
- 重点标注 fork 特有的适配：fork 没有 `task.type`、使用本地时区显示、保留 `sequences`、使用 `get-port@7.2.0`，且缺少上游的 publication-owner/batchTaskUpdates/refreshLocalTaskCorpus 机制。
- 建议迁移顺序：先做独立的 A 类（TUI watcher、append-plan、浏览器快捷键、loopback、BROWSER、里程碑过滤、autoCommit），然后 JSON 输出、CI 平台契约、composer、Web 异步加载，最后身份索引作为独立的大阶段。
- 警告上游 commit 前缀混淆（标为 `BACK-555` 的 commit 实际实现的是 BACK-564/562）。

## Related Concepts

- [[concepts/upstream-migration]] — fork 的上游迁移策略
- [[concepts/cli-entry]] — CLI 命令面
- [[concepts/core-architecture]] — 核心层与 ContentStore
- [[concepts/web-server]] — 服务器与 WebSocket

## Related Sources

- [[sources/doc-7-upstream-v1-48-0-to-v1-49-3-migration-classification]] — A/B/C 分类表
- [[sources/back-562-stable-json-output]] — CLI-1 JSON 输出
- [[sources/back-567-cross-branch-task-identity]] — CLI-2 身份索引
- [[sources/back-561-autocommit-exact-files]] — CLI-3 autoCommit
- [[sources/back-560-milestone-id-filtering]] — CLI-4 里程碑过滤
- [[sources/back-556-task-edit-append-plan]] — CLI-5 append-plan
- [[sources/back-410-cursor-agents-md-cleanup]] — CLI-7 AGENTS.md 清理
- [[sources/back-555-tui-live-refresh-atomic-writes]] — TUI-1 实时刷新
- [[sources/back-563-tui-intent-first-composer]] — TUI-2/3 composer
- [[sources/back-565-tui-theme-adaptive-scroll]] — TUI-4 主题/滚动
- [[sources/back-557-browser-shortcuts-inline-fields]] — WEB-1 键盘护栏
- [[sources/back-566-browser-async-loading]] — WEB-2/3 异步加载
- [[sources/back-558-browser-server-loopback-only]] — SERVER-1 仅回环
- [[sources/back-559-browser-launch-honor-browser-env]] — SERVER-2 BROWSER 启动
- [[sources/back-568-core-browser-task-boundary]] — SERVER-3 核心边界
