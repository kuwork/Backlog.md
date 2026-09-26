---
title: 空选择等于不过滤
description: BACK-652 统一四条状态过滤路径的空集合语义
labels: [decision, cli, tui, search]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# 空选择等于不过滤

## Context

`--status` 早已支持多值（重复与逗号分隔都返回并集），但后面有四份各自为政的 normalize-and-match 拷贝，trim 规则不一，且对空选择语义分裂：Fuse 搜索索引把空选择当"全不匹配"，而两个 store 把空选择当"不过滤"。

## Decision

一个共享 helper（`normalizeStatusSet` + `statusMatchesSet`：小写、trim、丢空白；**空集合 = 调用方跳过过滤**）统一四条路径（`Core.applyTaskFilters` include/exclude、`ContentStore.getTasks`、`FileSystem.listTasks`、Fuse 索引）。TUI 里所有对选择的真值判断改为 `.length` 判断，保证空列表始终意为"无过滤器"。刻意不动已一致的 `search-service.ts` 与已发数组的 web 任务列表。

## Rejected alternatives

- 保留索引的"空 = 全不匹配"语义——用户在弹窗里清空选择会得到永远为空的列表，与标签过滤器的既有行为矛盾
- 逐路径对齐而不抽 helper——四份拷贝正是漂移的根源（[[decisions/spread-passthrough-minimal-change]] 同类教训）

## Related Sources

- [[sources/back-652-multi-status-filter]] — 本决策的落地
- [[sources/back-649-shared-subtask-sorting]] — 同批另一处"共享实现替换重复拷贝"
