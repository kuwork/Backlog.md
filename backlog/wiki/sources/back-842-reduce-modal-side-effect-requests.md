---
title: BACK-842 - 削减任务详情弹窗的副作用请求
labels: [source, web-ui, task-modal, performance]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/tasks/back-842 - Reduce-TaskDetailsModal-side-effect-requests.md
---

# BACK-842 - 削减任务详情弹窗的副作用请求

BACK-839 的元数据防抖 flush 之后，弹窗还会发出一串 L1 摘要管不到的请求：依赖闭包被取两次（flush `finally` 里 `setClosureRefreshTick` 一次、编辑后 tasks 刷新推高 `tasksVersion` 触发闭包 effect 又一次），表单同步 effect 在每次 task prop 变化时都预载 `/api/tasks` 与 `/api/drafts`。即使 `/api/search` 被完美抑制，这四类副作用照发。

## 修复

- 从依赖闭包 effect 的依赖数组移除 `tasksVersion`。它原本在每次任务语料替换（广播或自身写入）时自增，迫使一次并不改变闭包的文档/元数据编辑也重新拉 `/api/task/:id/dependencies`；`tasksVersion` 只被这个 effect 消费，于是连带从组件 props 与 `App`（state + effect + prop 传递）一并删除。真实的内联依赖编辑仍会刷新闭包，因为两条写入路径都无条件 bump `closureRefreshTick`。
- 把 `fetchTasks` / `fetchDrafts` 从依赖 task prop 的表单同步 effect 移出，改由带 ref 的「每次打开一次」effect 守卫，依赖选择器与草稿建议只在弹窗打开时加载一次。

## 明确接受的取舍

外部编辑器在弹窗打开期间改了文件，闭包不再自动刷新（显示上次已知闭包，直到重新打开）。任务范围内可接受，代码注释里已记录。

## 效果与验证

一次文档编辑：闭包请求 2 → 1，tasks / drafts 预载不再随编辑后的刷新重跑。`tsc --noEmit`、Biome 干净；83 个 task-details/modal 测试 + 22 个 closure/documentation/inline-meta/broadcast 测试通过。

## Related Concepts

- [[concepts/web-ui-features]] — 弹窗 effect 依赖与请求预算

## Related Sources

- [[sources/back-840-corpus-digest-refresh-skip]] — L1 只覆盖 /api/search
- [[sources/back-839-batch-inline-metadata-edits]] — 触发链起点
