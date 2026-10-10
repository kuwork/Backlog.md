---
title: doc-16 - To-Do 任务与上游迁移对照报告
labels: [source, migration, backlog-hygiene]
created_date: 2026-09-08 17:00
updated_date: 2026-10-09 23:30
source_path: backlog/docs/migration/doc-16 - To-Do-任务与上游迁移v1.47.1-v1.50.1对照分析报告.md
---

# doc-16 - To-Do 任务与上游迁移对照报告

> **源文件已不存在（2026-10-03 lint）**：`source_path` 指向的 `backlog/docs/migration/doc-16 - To-Do-任务与上游迁移v1.47.1-v1.50.1对照分析报告.md` 已于 2026-09-15 被 commit `720d58ad`（"1.50.1到1.52.0升级分析"）删除，git 中无改名记录，`backlog/` 下按 doc-16 精确匹配无同名文件。本页保留作为该报告的 wiki 摘要，不再做 source_path 改写。

对账报告：将全部未完成的 To-Do 任务与三轮已完成的上游迁移（doc-4/doc-7/doc-9，覆盖 v1.47.1..v1.50.1）交叉核对。分析时 42 个未完成任务中，13 个作为已被迁移工作实现而归档，2 个作为决策跳过而归档，4 个标记为部分实现待人工比对验收标准，25 个确认仍未实现。每个「已实现」结论都用 `src/` 中的 grep 证据验证，而非仅凭文档。

报告要点：

- 经迁移实现而归档：BACK-430（TUI 任务创建，→BACK-563）、BACK-427（未指派过滤，→BACK-551）、BACK-429（web 草稿不丢失，→BACK-535）、BACK-426（文档内 hash 链接，→BACK-536）、BACK-240（Apple Silicon 二进制，→BACK-550）、BACK-424（web 状态过滤，→BACK-548），另有 BACK-257/310/259/260/415 已被 fork 原生代码覆盖。
- 决策跳过而归档：BACK-421（dateFormat 配置保持「已存储但未应用」，doc-4 C16）与 BACK-355 任务 type 字段及其 6 个子任务（为避免边缘化 labels 而丢弃，doc-4 C18）。
- 部分实现、待逐条验收标准审核：BACK-218（sequences 文档/测试）、BACK-270（命令替换输入防护）、BACK-222（web 子任务可视化）、BACK-239（任务↔文档/决策反向链接——前向链接已存在于 `src/web/utils/task-id-links.ts:200`，反向「Referenced by」缺失）。
- 经源码验证确认未实现、保持 To Do 的 25 个任务（sequences Web UI、agent skill 发布、XDG_CONFIG_HOME、npx 文档、核心漂移检测等）。
- 方法：阅读 3 份分类文档，把功能映射到任务，对每个疑似实现 grep `src/`，然后经 `backlog task archive` 归档——从不直接改文件。

## Related Concepts

- [[concepts/upstream-migration]] — 本报告把三轮迁移相对既有任务 backlog 对账，形成闭环
- [[concepts/task-lifecycle]] — 示范了用 CLI 归档作为被迁移工作取代任务的正确关闭方式
- [[concepts/search-sequences]] — BACK-217/218 sequences 条目是未实现任务中最大的集群之一

## Related Sources

- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — 本文对账的第三轮分类
- [[sources/doc-7-upstream-v1-48-0-to-v1-49-3-migration-classification]] — 本文对账的第二轮分类
- [[sources/doc-4-upstream-migration-classification]] — 本文对账的第一轮分类
