---
title: BACK-480 修复里程碑页面搜索模糊匹配误报
labels: [source]
source_path: backlog/tasks/back-480 - Fix-WebUI-milestone-page-search-fuzzy-matching-false-positives.md
created_date: 2026-05-20 23:45
updated_date: 2026-05-20 23:45
---

# BACK-480 修复里程碑页面搜索模糊匹配误报

**状态**: Done | **标签**: web-ui, bug | **优先级**: medium

修复 MilestonesPage 搜索短数字 ID 时产生大量误匹配的问题。例如搜索 `479` 会错误地包含 `BACK-349`、`BACK-449` 等无关任务。

## 根因

Fuse.js 的 `threshold: 0.35` 对短查询过于宽松。3 字符查询 `479` 与 `349` 的编辑距离为 1，score ≈ 0.33 < 0.35，被判定为匹配。

## 修复

在 `MilestonesPage.tsx` 的搜索逻辑中增加子串包含匹配作为前置过滤：
1. 精确 ID 匹配
2. ID 或 title 子串包含匹配
3. Fuse.js 模糊匹配（仅作为 fallback）

同时修复了未分配区域在搜索时隐藏已完成任务的问题，并为测试补充了缺失的 `I18nProvider`。

## Related Concepts
- [[concepts/search-sequences]] — Fuse.js 模糊搜索
- [[concepts/web-ui-features]] — Web UI 功能总览
