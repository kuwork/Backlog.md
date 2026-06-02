---
title: BACK-480 修复里程碑页面搜索模糊匹配误报
labels: [source]
source_path: backlog/tasks/back-480 - Fix-WebUI-milestone-page-search-fuzzy-matching-false-positives.md
created_date: 2026-05-20 23:45
updated_date: 2026-05-21 22:50
---

# BACK-480 修复里程碑页面搜索模糊匹配误报

**状态**: Done | **标签**: web-ui, bug | **优先级**: medium

修复 MilestonesPage 搜索短数字 ID 时产生大量误匹配的问题。例如搜索 `479` 会错误地包含 `BACK-349`、`BACK-449`、`BACK-447`、`BACK-379` 等无关任务。

## 根因

Fuse.js 的 `threshold: 0.35` 对短查询过于宽松。3 字符查询 `479` 与 `349` 的编辑距离为 1，score ≈ 0.33 < 0.35，被判定为匹配。页面原先仅搜索 `task.id` 和 `task.title`，缺少子串前置过滤。

## 修复

在 `MilestonesPage.tsx` 的 `visibleBuckets` memo 中增加三层匹配策略：
1. **精确 ID 匹配**（`task.id === query`）
2. **子串包含匹配**（`id.includes(query) || title.includes(query)`）
3. **Fuse.js 模糊匹配**（仅作为 fallback）

同时修复未分配区域在搜索时隐藏已完成任务的问题：搜索激活时显示所有匹配任务（包括 Done），非搜索状态才过滤掉 Done 任务。

## 测试修复

- 为里程碑页面测试补充缺失的 `I18nProvider` 包裹
- 断言文本对齐实际 locale 输出
- 新增测试用例验证子串搜索不会模糊匹配无关 ID

## 相关概念
- [[concepts/search-sequences]] — Fuse.js 模糊搜索
- [[concepts/web-ui-features]] — Web UI 功能总览
