---
title: doc-6 B 类上游任务迁移分析报告
labels: [source, doc, migration]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/docs/migration/doc-6 - B类上游任务迁移分析报告（v1.47.1-..-v1.48.0）.md
---

# doc-6 B 类上游任务迁移分析报告（v1.47.1 .. v1.48.0）

对 doc-4 中 B 类（评估合入）各项做逐项迁移深析。

## 核心内容

按「fork 现状 / 定制冲突 / 迁移价值 / 建议 / 风险」分析。

**建议迁移**：B3/B4/B5/B6/B7/B8/B10/B11/B12/B13（多数已创建迁移任务）。

**建议跳过**：
- **B1**（上游 `/board/*`/`/tasks/*` 路由）：fork 已有 `/task/:id/:title` 路由，与上游冲突
- **B9**（dateFormat）：上游基于 UTC 显示，与 fork 本地时区契约及 datetime-local 控件根本冲突
- **B2**（自定义优先级）：评估为高风险，不建议迁移

## 勘误记录

doc-4 中 B8 的 DRAFT#36 链接错误——draft-36 实为 win32-arm64 预编译二进制，B8 应参考上游 commit `17ca0bf`/PR #660（并已找回 DRAFT#81）。

## 优先级

B7/B13/B4/B11/B12 最小改动立即收益；B10（构建现代化）单独立项高关注。

## Related Concepts
- [[concepts/web-ui-features]] — 迁移涉及的 UI 优化
- [[concepts/cli-entry]] — CLI 迁移

## Related Sources
- [[sources/doc-4-upstream-migration-classification]] — 分类入口
- [[sources/back-548-status-exclude-filtering]] — B3
- [[sources/back-553-modernize-browser-bundling]] — B10
