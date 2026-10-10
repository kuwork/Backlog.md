---
title: m-10 - Memos Integration 里程碑
labels: [source, milestone, memos]
created_date: 2026-10-03 01:25
updated_date: 2026-10-09 23:30
source_path: backlog/milestones/m-10 - memos-integration.md
---

# m-10 - Memos Integration 里程碑

本里程碑涵盖 Memos 快速捕捉功能线，2026-10-01 一天内执行完成（actual_start 10:14 → actual_end 2026-10-02 01:27）。其 `documentation` 字段引用设计文档 doc-20。

范围：将 Memos 的"快速捕捉 + 日历"引入 Backlog.md——轻量 memo 实体（`backlog/memos/*.md`）镜像 docs 设计，接入现有文件存储 / HTTP API / 搜索 / Markdown 渲染流水线，以单个 `/memos` 页面交付，内含联动的 Feed 与 Calendar 模式。设计文档：`backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md`。任务链：BACK-728（存储层）→ BACK-729（HTTP API）→ BACK-730（CLI 子命令）→ BACK-731（feed 页面）→ BACK-732（日历模式）→ BACK-733（全局搜索）→ BACK-734（知识网络链接）→ BACK-735（实时同步）→ BACK-736（回归与验收通过）→ BACK-737（UI 打磨）→ BACK-738（卡片菜单 / 模态框背景修复）→ BACK-740（MCP 工具）。

## 验收标准

不适用（里程碑记录）；上述任务链即作为完成定义。

## Related Concepts

- [[concepts/memos]] — memo 实体及其与 ContentStore 重型实体系统的刻意边界

## Related Sources

- [[sources/doc-20-memos-integration]] — 本里程碑实施的设计文档
- [[sources/back-728-memo-storage-layer]] — 任务链首个任务（核心存储层）
