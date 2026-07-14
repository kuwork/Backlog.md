---
title: 路径自动补全允许发现 .backlog 目录
description: BACK-526 选择从 excludeDirs 中移除 .backlog，同时保留对其他点前缀目录的隐藏
labels: [decision, web-ui, autocomplete, file-system]
created_date: '2026-07-14 07:14'
updated_date: '2026-07-14 07:14'
---

# 路径自动补全允许发现 .backlog 目录

## 背景

BACK-479 为任务 References / Documentation 的路径自动补全实现了全局项目文件搜索。原实现用 `entry.name.startsWith(".")` 跳过所有点前缀目录，导致用户输入 `.back` 时无法发现 `.backlog` 目录，与 BACK-479 的排除列表意图不符。

## 备选方案

| 方案 | 优点 | 缺点 |
|---|---|---|
| A. 从 excludeDirs 移除 `.backlog`，单独放行该点前缀目录 | 用户可发现 backlog 配置与数据目录；其他点目录仍隐藏 | 需要两处逻辑配合（excludeDirs + 点前缀守卫） |
| B. 完全取消点前缀过滤 | 实现最简单 | `.git`、`.github`、`.husky` 等目录暴露，噪音大 |
| C. 将 `.backlog` 重命名为非点前缀 | 一劳永逸 | 破坏性变更，影响所有现有项目 |

## 决策

选择 **方案 A**。

理由：
1. 与 BACK-479 原始排除列表意图一致（仅排除特定目录）
2. `.backlog` 是 Backlog.md 工作目录，用户可能需要引用其中的 wiki、docs 等文件
3. 不影响其他点目录的隐藏行为

## 实现要点

- `excludeDirs` 从 `node_modules`、`.git`、`dist`、`build`、`.backlog`、`.locks` 改为 `node_modules`、`.git`、`dist`、`build`、`.locks`
- 遍历条件从 `entry.name.startsWith(".")` 改为 `entry.name.startsWith(".") && entry.name !== ".backlog"`

## 相关来源
- [[sources/back-526-create-task-references-and-backlog-autocomplete]]
- [[sources/path-autocomplete-task]]
