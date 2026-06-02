---
title: BACK-500 看板标签颜色自定义与卡片标签溢出优化
labels: [source]
source_path: backlog/tasks/back-500 - Kanban-label-color-customization-and-card-label-overflow-optimization.md
created_date: 2026-05-30 10:20
updated_date: 2026-05-30 10:20
---

# BACK-500 看板标签颜色自定义与卡片标签溢出优化

**状态**: Done | **标签**: web-ui, enhancement | **优先级**: medium

## 功能一：标签颜色自定义

为 Kanban 看板任务卡片标签添加颜色自定义能力，替代默认灰色背景。

### 实现要点

- **配置存储**：`BacklogConfig` 新增 `labelColors?: Record<string, string>`，`config.yml` 中以 YAML inline object 形式持久化（仅保存非默认颜色）
- **预设调色板**：`src/web/utils/labelColors.ts` 提供 17 种预设色，映射到 Tailwind `bg-*-200` / `dark:bg-*-800` 类对，自动支持暗黑模式
- **颜色选择器**：`LabelFilterDropdown` 中每个标签行右侧添加颜色 swatch，点击展开 4×4 网格 + Default 选项 + Save/Cancel 按钮的 inline picker
- **组件透传**：`App.tsx` → `BoardPage` → `Board` → `TaskColumn` → `TaskCard` 全链路 props plumbing

### 关键决策

- 配置中存储颜色 key 字符串（如 `"red"`、`"blue"`），而非原始 hex/CSS，以保持 dark mode 支持与体积小巧
- 暗黑模式使用 solid `dark:bg-*-800` 替代半透明 `dark:bg-*-900/40`，消除暗淡外观

## 功能二：卡片标签宽度自适应溢出

`TaskCard` 从硬编码最多显示 3 个标签，改为基于容器宽度动态计算可显示标签数量。

### 实现要点

- **测量容器**：渲染隐藏的完整标签列表，通过 `getBoundingClientRect` 获取每个标签宽度
- **ResizeObserver**：监听卡片宽度变化，实时重新计算 `visibleCount`
- **回退策略**：JSDOM 测试环境中 `ResizeObserver` 不存在，effect 提前退出，显示全部标签（安全回退）

## 修改文件

- `src/types/index.ts` — `labelColors` 字段
- `src/file-system/operations.ts` — `parseConfig`/`serializeConfig` 处理 `label_colors`
- `src/web/utils/labelColors.ts` — **新建** 共享调色板工具
- `src/web/components/LabelFilterDropdown.tsx` — 颜色 swatch 与 inline picker
- `src/web/components/TaskCard.tsx` — `WidthAwareLabels` 子组件
- `src/web/components/TaskColumn.tsx` / `Board.tsx` / `BoardPage.tsx` / `App.tsx` — props 透传
- `src/web/locales/*.ts` — `common.default` 翻译
- `src/test/filesystem.test.ts` — labelColors 持久化测试

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/web-server]] — Web Server API 与配置接口

## Related Sources
- [[sources/web-ui-i18n-task]] — BACK-478 i18n 支持（翻译基础设施共享）
