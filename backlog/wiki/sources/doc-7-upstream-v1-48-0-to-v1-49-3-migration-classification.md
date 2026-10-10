---
title: doc-7 - 上游 v1.48.0→v1.49.3 迁移差异分类
labels: [source, doc, migration, upstream]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/docs/migration/doc-7 - Upstream-v1.48.0-to-v1.49.3-Migration-Diff-Classification.md
---

# doc-7 - 上游 v1.48.0→v1.49.3 迁移差异分类

上游 `MrLesk/Backlog.md` `v1.48.0 .. v1.49.3` 区间（139 个 commit、33 个任务组）的 A/B/C 差异分类，按领域组织。

分类要点：

- 优先级再分类后的最终结果：**13 A / 5 B / 10 C**。
- A 类条目映射到 fork 任务 BACK-562、BACK-567、BACK-561、BACK-560、BACK-556、BACK-558、BACK-559、BACK-555、BACK-563、BACK-565、BACK-557、BACK-566，以及 draft-89（CI）。
- B 类条目包括任务 type 字段（draft-80）、AGENTS.md 清理（BACK-410）、测试可靠性，以及可选的 TUI/Web 增强。
- C 类条目跳过：Nix bun2nix v2、上游独有文档、UTC 显示策略、上游未实现的想法，以及 fork 已覆盖或拒绝的功能。
- 领域分组：CLI/Core、TUI、Web、Server、Infra/CI、Nix。
- 给出复用与重写建议：① 直接复用、② 参考重写、③ 忽略。

## Related Concepts

- [[concepts/upstream-migration]] — fork 的上游迁移策略
- [[concepts/core-architecture]] — 核心/标识架构
- [[concepts/web-server]] — 服务器侧迁移条目

## Related Sources

- [[sources/doc-4-upstream-migration-classification]] — 上一版 v1.47.1→v1.48.0 分类
- [[sources/doc-8-upstream-v1-49-3-migration-analysis-by-domain]] — 逐条详细分析
