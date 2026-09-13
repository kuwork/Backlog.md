---
title: 浏览器 bundle 只导入纯模块
description: BACK-628 从 task-path 改 task-id 以避免把 Core 拖进前端 bundle
labels: [decision, web-ui, build, architecture]
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
---

# 浏览器 bundle 只导入纯模块

## 背景

BACK-628 的层级区块需要前缀无关的 ID 比较。最初从 `src/utils/task-path.ts` 导入 `taskIdsEqual`，该模块间接依赖 Core（文件系统/内容存储），浏览器 bundle 因此被打包进 Node 侧代码，Web UI 直接白屏。

## 决策

浏览器代码只从**纯模块**导入共享逻辑；ID 比较改用 `src/utils/task-id.ts` 的 `canonicalTaskId`。

## 理由与边界

- `src/utils/task-id.ts` 有零 Node 依赖，是渲染端与输入端共同复用的最小契约（BACK-614 已把 `canonicalTaskId` 抽到这里，正是为了两侧复用）
- bundle 泄漏不会在类型检查或单元测试中暴露——`renderToString` 测试仍会通过，只有真实浏览器加载才白屏。因此这是"运行时才可见"的架构约束，必须靠约定而非工具保证
- 判定标准：新共享逻辑要么放进纯模块，要么在使用点本地实现，不得为了复用把 Node 侧模块拉进 `src/web/`

## Related Sources

- [[sources/back-628-task-hierarchy-section]] — BACK-628 发现并修复
- [[sources/back-614-entity-id-auto-link-autocomplete]] — BACK-614 抽出 `canonicalTaskId` 纯模块
