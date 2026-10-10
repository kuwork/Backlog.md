---
title: 空 Setter 值拒绝而非按 emptyClears 清除
labels: [decision]
created_date: 2026-09-08 17:02
updated_date: 2026-10-09 23:30
---

# 空 Setter 值拒绝而非按 emptyClears 清除

## 背景

BACK-577/578 为 `task edit` 的列表字段（--ref/--doc/--dep）定义语义。上游 c9bbdbd 引入了 `emptyClears` 语义：向列表字段显式传空值即表示清除该字段。

## 决定

fork 采用 set / add / remove / clear 四语义：空 setter 值直接报错，并在错误信息中指向 `--clear-*` 标志。**刻意与上游 c9bbdbd 的 emptyClears 语义分叉**——上游中显式空值等于清除，fork 中显式空值等于错误。

## 理由

- fork 的列表 setter 语义由此保持一致的"显式动作"风格：改列表必须说清楚是设置、追加、移除还是清空。
- 空值静默清空容易在脚本拼接出错时意外抹掉数据，报错能把这类失误变成显式反馈。
- 错误信息直接指向 `--clear-*`，用户无需查文档即可修正。

## 被否方案

- **沿用上游 emptyClears**：与 fork 既有的列表 setter 语义不一致，且掩盖脚本中的空值拼接错误。

## Related Concepts

- [[concepts/task-lifecycle]] — 列表 setter 语义所属的任务生命周期概念域
- [[concepts/upstream-migration]] — 与上游 c9bbdbd emptyClears 语义分叉的迁移背景

## Related Sources

- [[sources/back-577-clear-deps-refs-docs-empty-setter-rejection]] — --ref/--doc/--dep 空值直接报错的核心任务
- [[sources/back-578-task-edit-list-set-add-remove-flags]] — set/add/remove/clear 四语义的标志设计
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — 上游 emptyClears 变更的迁移差异分类
