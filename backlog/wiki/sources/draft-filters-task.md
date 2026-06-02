---
title: BACK-486 草稿页添加筛选功能
labels: [source]
source_path: backlog/tasks/back-486 - Add-filters-to-drafts-page.md
created_date: 2026-05-23 15:10
updated_date: 2026-05-23 15:18
---

# BACK-486 草稿页添加筛选功能

**状态**: Done | **标签**: web-ui, drafts, filtering, ux | **优先级**: medium | **依赖**: BACK-485

## 目标

为草稿页面（`/drafts`）添加与任务列表页（`/tasks`）一致的筛选栏，支持多维筛选和关键字搜索。

## 实现

### 筛选栏布局
- **左侧控件**：关键字搜索 → 状态筛选 → 优先级筛选 → 里程碑筛选 → 标签筛选
- **右侧**："清除筛选"按钮（有活跃筛选时显示）+ `显示 X / Y 个草稿` 结果计数器

### 筛选控件
- **关键字搜索**：带搜索图标和清除按钮的文本输入框；按草稿 ID 或标题做子串匹配（不区分大小写）
- **状态筛选**：下拉框，所有可用状态
- **优先级筛选**：下拉框（全部 / 高 / 中 / 低）
- **里程碑筛选**：下拉框（全部里程碑 / 无里程碑 / 各个活跃里程碑）
- **标签筛选**：多选 chip 输入（复用 `LabelFilterDropdown`），带自动补全

### 技术细节
- 所有筛选均为客户端执行（`useMemo`）
- 筛选状态通过 `useSearchParams` 同步到 URL：`?status=&priority=&milestone=&label=&q=`
- 空状态双模式：无草稿时显示 "暂无草稿"；筛选无结果时显示 "没有符合筛选条件的草稿"

### 代码变更
- **`src/web/components/DraftsList.tsx`**：完全重写，添加 `useSearchParams` 状态管理、5 个筛选维度、`filteredDrafts` 计算
- **`src/web/App.tsx`**：移除未使用的 `archivedMilestones` prop
- **`src/web/locales/{en,zh-CN,zh-TW,ja}.ts`**：添加 `drafts.showingCount`、`drafts.noDraftsMatchFilters`、`drafts.tryAdjustingFilters`、`drafts.searchPlaceholder`；清理 `taskDetails` 命名空间中的重复键
- **`src/web/components/PathAutocomplete.tsx`**：顺手修复未使用变量的 TS 错误

## 相关概念
- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/web-ui-i18n]] — Web UI 国际化（4 语言类型安全翻译字典）
- [[sources/draft-promote-flow-task]] — BACK-485 草稿提升流程修复
