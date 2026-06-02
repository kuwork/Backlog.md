---
title: "不使用外部甘特图库"
labels: [decision, gantt, web-ui, dependencies]
created_date: 2026-05-28 00:50
updated_date: 2026-05-28 00:50
---

# 不使用外部甘特图库

## 决策内容

BACK-491 智能甘特图视图采用纯 React/CSS 自研实现，不引入 DHTMLX Gantt、Frappe Gantt 或任何其他第三方甘特图库。

## 背景

市面上成熟的甘特图库功能丰富，但 Backlog.md 作为编译为单文件可执行程序的 CLI 工具，对 bundle 体积和依赖控制有较高要求。Web UI 已基于 React + Tailwind CSS v4 构建了完整的组件体系。

## 拒绝方案

- **DHTMLX Gantt**：功能全面但体积大，商业许可限制，Tailwind 暗黑模式适配困难
- **Frappe Gantt**：轻量但定制受限，依赖 jQuery 风格 API，与现有 React 体系不一致
- **任何其他图表库**：增加构建复杂性和运行时依赖

## 采纳方案

纯 React/CSS 自研：
- 零新增依赖
- 完全可控的渲染和交互
- Tailwind CSS `dark:` 变体原生支持暗黑模式
- 与现有组件（`TaskDetailsModal`、排序交互、i18n）无缝集成

## 代价

- 开发工作量大于直接引入库
- 需要自行实现时间线缩放、拖拽平移、依赖箭头计算

## 相关来源

- [[sources/smart-gantt-view-task]] — BACK-491 Out of Scope 明确排除外部库
- [[reasoning/back-491-smart-gantt-view]] — 规划痕迹中的方案对比
