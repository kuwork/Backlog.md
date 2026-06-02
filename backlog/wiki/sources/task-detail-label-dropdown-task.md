---
title: BACK-501 任务详情标签输入添加下拉框与模糊过滤
labels: [source]
source_path: backlog/tasks/back-501 - Task-detail-label-input-needs-dropdown-with-fuzzy-filter.md
created_date: 2026-05-30 10:20
updated_date: 2026-05-30 10:20
---

# BACK-501 任务详情标签输入添加下拉框与模糊过滤

**状态**: Done | **标签**: web-ui, enhancement | **优先级**: medium

为 `TaskDetailsModal` 中的标签 `ChipInput` 添加自动完成下拉框，解决自由文本输入导致的标签命名不一致、拼写错误和遗忘已有标签的问题。

## 功能

1. **下拉框提示**：focus 或输入时显示项目中已有标签列表（配置标签 + 所有任务中的标签，通过 `collectAvailableLabels` 合并去重）
2. **模糊搜索过滤**：用户输入时按字符顺序模糊匹配（如 `we` 匹配 `web-ui`）
3. **新标签创建**：输入内容不匹配任何现有标签时，按 Enter 创建新标签
4. **大小写不敏感重复检测**：防止添加与已有标签仅大小写不同的重复项（如已有 `feature` 时阻止添加 `Feature`）
5. **重复视觉反馈**：尝试添加重复标签时输入框边框变红，下拉框显示 `feature already added` 提示

## 实现要点

- **数据流**：`App.tsx` 通过 `collectAvailableLabels(tasks, availableLabels)` 计算合并标签列表，传递给 `TaskDetailsModal`，再传给 `ChipInput` 的 `availableOptions` prop
- **已选过滤**：下拉框中已选标签（大小写不敏感）被过滤掉，避免重复显示
- **键盘导航**：上下箭头高亮选项，Enter 选择，Escape 关闭下拉框
- **点击外部关闭**：`document.addEventListener('mousedown')` 检测外部点击

## 修改文件

- `src/web/components/ChipInput.tsx` — 核心改动：添加 `availableOptions` prop、下拉框状态管理、模糊匹配、重复检测
- `src/web/components/TaskDetailsModal.tsx` — 接收 `availableLabels` prop 并传给 `ChipInput`
- `src/web/App.tsx` — 导入 `collectAvailableLabels` 并传递合并后的标签

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/task-lifecycle]] — 任务生命周期与元数据编辑

## Related Sources
- [[sources/label-color-customization-task]] — BACK-500 标签颜色自定义（共享标签基础设施）
