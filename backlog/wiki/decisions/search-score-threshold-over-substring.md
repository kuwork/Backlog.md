---
title: 搜索统一使用 0.45 Fuse 分数阈值
labels: [decision, search, fuse]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
---

# 搜索统一使用 0.45 Fuse 分数阈值

## 背景

TUI/CLI/MCP 搜索短数字查询（如 `63`）会误匹配无关任务 ID（如 `BACK-410`），因为 Fuse.js 默认 0.35 阈值过宽。上游 Web UI 已通过 SideNavigation 使用 0.45 阈值过滤。

## 决定

BACK-564 对齐所有搜索表面，统一使用 0.45 分数阈值。

覆盖范围：

- TUI kanban 搜索、TUI 任务列表搜索
- CLI search
- MCP task/document search

## 理由

- 与 Web UI 行为一致，减少表面间差异
- 0.45 足够过滤编辑距离导致的数字误匹配，同时保留文本查询的 Fuse 语义

## 被否方案

- 数字专用子串分支：已尝试后回退——阈值方法更简单、与 Web 完全一致

## Related Sources

- [[sources/back-564-search-score-threshold]] — 阈值对齐实现
