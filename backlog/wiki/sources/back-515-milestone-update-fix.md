---
title: BACK-515 修复 Web API 里程碑更新响应缺失里程碑对象
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [source, bug, web-api, milestones]
source_path: backlog/tasks/back-515 - Fix-Web-API-milestone-update-missing-milestone-in-response.md
---

# BACK-515 修复 Web API 里程碑更新响应缺失里程碑对象

修复 `PUT /api/milestones/:id` 返回 `{success, message}` 却不包含更新后里程碑对象的问题。

## 根因

`handleUpdateMilestone` 在调用 `editMilestone` 后，仅返回 `{success, message}`，未获取并包含更新后的里程碑。

## 修复

- 在编辑前先加载源里程碑以获取规范 ID
- 在 `editMilestone` 成功后重新加载更新后的里程碑
- 将其包含在 JSON 响应中
- 添加源里程碑未找到时的 404 防护

## 相关概念
- [[concepts/web-server]] — Server API 处理器
- [[concepts/web-ui-features]] — 里程碑页面

## 相关来源
- [[sources/back-514-auto-port]] — Server 相关修复
