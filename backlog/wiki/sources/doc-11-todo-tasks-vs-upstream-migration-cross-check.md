---
title: doc-11 - To-Do 任务与上游迁移对照分析
labels: [source, upstream-migration, housekeeping]
created_date: 2026-09-26 14:15
updated_date: 2026-10-09 23:30
source_path: backlog/docs/migration/doc-11 - To-Do-任务与上游迁移v1.47.1-v1.50.1对照分析报告.md
---

# doc-11 - To-Do 任务与上游迁移对照分析

对照报告：将当时全部 42 个 To Do 任务与三轮已完成的上游迁移（doc-4/doc-7/doc-9，v1.47.1→v1.50.1）逐一对账。与分类表不同，本报告每个「已实现」结论都由 `src/` 中 grep 验证的 `file:line` 证据支撑，而非文档说法。

报告要点：

- 42 个 To Do 任务的判定分布：13 个在迁移期间作为已实现归档（11 个确认 + 2 个有意跳过，含 BACK-355 的六个子任务——共 19 个文件），4 个部分实现待人工比对验收标准，25 个确实未实现仍在计划中。
- 已实现并归档的示例（附证据）：BACK-430 TUI 看板任务创建（`task-composer.ts`，经由 BACK-563）、BACK-427 `--unassigned` 过滤（BACK-551）、BACK-429 保留 web 草稿（BACK-535）、BACK-240 Apple Silicon 二进制解析（`scripts/resolveBinary.cjs`，BACK-550）、BACK-424 web 多状态过滤（BACK-548）。
- 决策跳过：BACK-421（dateFormat 配置保持惰性，doc-4 C16）与 BACK-355 任务 `type` 字段及其全部六个子任务（为避免边缘化 labels 而丢弃，doc-4 C18）。
- 部分实现、需人工审核验收标准：BACK-218 sequences 文档/测试、BACK-270 命令注入加固（AC#3 未验证）、BACK-222 web 子任务可视化（无折叠/进度徽标）、BACK-239 任务↔文档自动链接（缺「Referenced by」反向链接）。
- 25 个未实现任务多为与上游无关的 fork 原生需求（sequences web UI、agent skill 发布、XDG_CONFIG_HOME、Docker 运行时、web 主题定制等）。
- 方法：阅读三份差异分类文档，将每个 To Do 任务映射到迁移功能点，再 grep `src/` 找真实实现；归档一律通过 `backlog task archive` 完成，从不直接改文件。

## 验证

不适用（分析报告）；交付物为四象限判定表加每个「已实现」结论的源代码证据。

## Related Concepts

- [[concepts/upstream-migration]] — 本报告审计 doc-4/doc-7/doc-9 迁移轮次相对既有 backlog 的落地结果

## Related Sources

- [[sources/doc-4-upstream-migration-classification]] — v1.47.1→v1.48.0 分类，多条迁移溯源的出处
- [[sources/doc-7-upstream-v1-48-0-to-v1-49-3-migration-classification]] — 所引用的第二轮迁移
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — 所引用的第三轮迁移
- [[sources/doc-16-todo-tasks-vs-upstream-migration-report]] — 同族的 To Do 对账报告
