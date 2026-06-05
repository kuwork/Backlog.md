---
title: Markdown 链接解析添加 # 锚点前缀守卫
description: BACK-511 防止 heading anchor 被误识别为本地 URL
labels: [decision, web-ui, markdown]
created_date: '2026-06-05 15:19'
updated_date: '2026-06-05 15:19'
---

# Markdown 链接解析添加 # 锚点前缀守卫

## 背景

BACK-511 的 `parseLocalUrl()` 使用 `new URL(href, window.location.href)` 解析链接。当 heading anchor（如 `#changes-made`）传入时，`new URL` 会继承当前页面路径名（如 `/task/BACK-506`），导致纯锚点被误判为 `/task/BACK-506#changes-made` 并尝试匹配本地 URL 模式。

## 决策

在 `parseLocalUrl()` 和 `parseTaskUrl()` 的入口添加显式守卫：

```ts
if (href.startsWith("#")) return null;
```

- 纯锚点链接原样渲染，不转换别名
- 不影响真正的本地 URL（如 `/task/506`）

## 相关来源
- [[sources/local-url-short-aliases-task]] — BACK-511 实现
