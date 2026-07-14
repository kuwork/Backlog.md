---
title: Web 日期清除使用空字符串而非 undefined
description: BACK-528 选择让客户端发送空字符串，避免 JSON.stringify 丢弃 undefined 导致清除失效
labels: [decision, web-ui, dates, api]
created_date: '2026-07-14 07:14'
updated_date: '2026-07-14 07:14'
---

# Web 日期清除使用空字符串而非 undefined

## 背景

Web 任务详情模态框的日期选择器提供 "Clear" 按钮。清除后若客户端发送 `undefined`，`JSON.stringify` 会丢弃该字段，服务端无法区分「未修改」与「清空」，导致原日期值继续保留在 Markdown 文件中。

## 备选方案

| 方案 | 优点 | 缺点 |
|---|---|---|
| A. 客户端发送空字符串 | 服务端已有 `applyOptionalDateField` 支持空字符串转删除；改动最小 | 需要调整所有日期 onChange 与 handleSave 逻辑 |
| B. 服务端支持显式 `null` | 语义清晰 | 需要新增 null 处理分支；前端仍需改动 |
| C. 引入单独清除 API | 不受 JSON 序列化影响 | 增加接口复杂度；与实际字段更新分离 |

## 决策

选择 **方案 A**。

理由：
1. 复用服务端现有空字符串语义，不引入新概念
2. 改动集中在前端 `TaskDetailsModal.tsx`，测试覆盖即可
3. 保持 PUT payload 与字段更新语义一致

## 相关来源
- [[sources/back-528-web-task-detail-date-clear-persisting]]
