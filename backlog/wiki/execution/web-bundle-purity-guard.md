---
title: 浏览器 bundle 纯净性守卫
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
labels: [execution, web-ui, build]
---

# 浏览器 bundle 纯净性守卫

## 适用场景

在 `src/web/` 中需要复用一段已存在于 `src/utils/` 或 `src/core/` 的逻辑时。

## 问题模式

`src/web/` 的导入链如果触达 Core（文件系统、内容存储、Node 内置模块），打包器会把 Node 侧代码带进浏览器 bundle，页面白屏。类型检查通过、`renderToString` 组件测试通过——**只有真实浏览器加载才失败**。

## 标准步骤

1. 先判断目标模块是否纯净：沿导入链检查是否存在 `node:fs`、Core、FileSystem、ContentStore 等依赖
2. 纯净 → 直接 import（如 `src/utils/task-id.ts` 的 `canonicalTaskId`）
3. 不纯净 → 二选一：把需要的纯函数**抽到独立纯模块**（首选，双方复用），或在 Web 侧本地实现一小段
4. 绝不为"复用"把 Node 侧模块拉进 `src/web/`
5. 改完后必须真实浏览器验证页面能渲染，不要只依赖单测

## 历史案例

| 任务 | 错误导入 | 症状 | 修正 |
|---|---|---|---|
| BACK-628 | `taskIdsEqual` from `src/utils/task-path.ts`（链到 Core） | Web UI 白屏 | 改用纯模块 `src/utils/task-id.ts` 的 `canonicalTaskId` |
| BACK-614 | —— | —— | 抽出 `canonicalTaskId` 到纯模块，成为渲染/输入两侧共享契约 |

## 参考决策

- [[decisions/pure-task-id-module-in-browser-bundle]]

## Related Concepts

- [[concepts/task-identity]] — `canonicalTaskId` 所在的身份契约
- [[concepts/core-architecture]] — Core 与浏览器边界（BACK-568 的 server/web 只走 Core 是另一方向的边界）
