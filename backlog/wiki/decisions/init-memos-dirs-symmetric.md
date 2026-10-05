---
title: init 对称创建 backlog/memos 与 archive/memos
labels: [decision, cli, init, memos]
created_date: '2026-10-05 08:25'
updated_date: '2026-10-05 08:25'
---

# init 对称创建 backlog/memos 与 archive/memos

## 决策内容

BACK-747 修复 `ensureBacklogStructure()`：init 一次性创建 `backlog/memos` 和 `backlog/archive/memos` 两个目录，与 `archive/tasks`、`archive/drafts`、`archive/milestones` 保持对称。

## 背景

init 的目录清单里有 tasks/drafts/completed 与三种 archive 子目录，唯独没有 memo 相关目录——`backlog/memos` 一直靠 `core/memos.ts` 首次写入时惰性 mkdir，缺口从未暴露。

## 拒绝方案

- **只建 backlog/memos，archive/memos 按需创建**：从未归档过的项目不留空目录；但与既有 archive 目录不对称，init 的目录清单出现特例
- **维持现状（纯惰性创建）**：新项目的目录结构依赖"恰好写了一条 memo"这一副作用

## 采纳方案

- 对称性优先：init 的目录清单是一条可枚举的完整契约，memo 目录不该是例外
- `core/memos.ts` 保留按需 mkdir，init 建过之后是 no-op，两处逻辑不冲突
- 既有项目缺哪个目录，下次 init 补哪个——init 同时承担修复职责

## Related Sources

- [[sources/back-747-memo-archiving]] — 本决策的实现任务
