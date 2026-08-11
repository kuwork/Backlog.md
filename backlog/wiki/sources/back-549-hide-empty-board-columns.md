---
title: BACK-549 看板无任务时隐藏空状态列
labels: [source, web-ui, config]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-549 - Hide-empty-status-columns-on-Board-when-no-tasks.md
---

# BACK-549 看板无任务时隐藏空状态列

看板列无任务时仍显示造成杂乱，新增 `hideEmptyColumns` 配置隐藏空状态列。

## 解决方案

新增 `BacklogConfig.hideEmptyColumns`（默认 false，既有用户无感知），持久化到 config.yml 的 `hide_empty_columns`。

- **Web**：Settings 在 Auto Open Browser 后新增开关，i18n 4 语言；配置从 App.tsx 经 BoardPage 透传至 Board。Board 用 useMemo 计算 visibleStatuses：启用且无拖拽时仅保留在所有可见泳道 displayTasksByLane 中至少有一个任务的状态，否则原样返回；拖拽中（dragSourceStatus 非空）保持全部状态可见以作为有效放置目标。渲染改用 visibleStatuses.map 与 visibleStatuses.length
- **CLI**：config get/set/list 支持该字段（布尔校验 true|false|1|0|yes|no）

## 实现位置

- `src/types/index.ts`、`src/file-system/operations.ts`、`src/cli.ts`
- `src/web/App.tsx`、`src/web/components/Board.tsx`、`BoardPage.tsx`、`Settings.tsx`
- 文案 `src/web/locales/{en,ja,zh-CN,zh-TW}.ts`

## 测试

`src/test/config-commands.test.ts`（get/set/list 往返，13 通过）、board tests 14 通过。

## Related Concepts
- [[concepts/web-ui-features]] — 看板视图
- [[concepts/core-architecture]] — 配置层

## Related Sources
- [[sources/back-548-status-exclude-filtering]] — 看板过滤
