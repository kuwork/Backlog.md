---
title: BACK-478 Web UI i18n 支持
labels: [source]
source_path: backlog/tasks/back-478 - Web-UI-i18n-support.md
created_date: 2026-05-17 02:20
updated_date: 2026-05-17 02:20
---

# BACK-478 Web UI i18n 支持

**状态**: Done | **标签**: feature, web-ui, i18n | **优先级**: medium

为 Web UI 添加国际化（i18n）支持，将 ~20+ React 组件中硬编码的英文文本提取到类型安全的翻译字典中，并允许用户通过设置页面切换语言。

## 范围与语言

- **范围**：仅 Web UI，CLI 与 TUI 不在范围内
- **语言**：英语（`en`，默认）、日语（`ja`）、简体中文（`zh-CN`）、繁体中文（`zh-TW`）
- **键数**：~300 个翻译键，覆盖 4 种语言

## 架构决策

采用**零依赖轻量级 i18n**方案——自定义 React Context + Hook，避免引入 i18next 等重型库，以保持编译后单文件二进制体积小巧。

## 基础设施

```
src/web/
├── locales/
│   ├── index.ts      # Locale union类型、加载器、fallback
│   ├── en.ts         # 英语字典（source of truth）
│   ├── ja.ts         # 日语字典
│   ├── zh-CN.ts      # 简体中文字典
│   └── zh-TW.ts      # 繁体中文字典
├── contexts/
│   └── I18nContext.tsx   # 提供 locale 状态与 t() 函数
└── hooks/
    └── useI18n.ts        # 消费翻译的 Hook
```

- **完全 TypeScript 类型安全**：`TranslationDict = DeepString<typeof en>`，访问缺失键会产生编译时错误
- **字符串插值支持**：`t.common.removeItem(item)`、`t.taskList.showingCount(current, total)` 等函数式键
- **编译时嵌入**：翻译文件以模块形式导入，由 `bun build --compile` 内联到单文件二进制中，无运行时文件系统读取

## 配置集成

- `BacklogConfig` 添加可选 `locale?: string` 字段（`src/types/index.ts`）
- 通过现有 `/api/config` GET/PUT API 透传，无需新增后端端点
- `Settings.tsx` 添加语言选择下拉框（English / 日本語 / 简体中文 / 繁體中文）
- 未设置时回退到 `en`，也可通过 `navigator.language` 检测

## 完全国际化的组件

Board、TaskList、TaskDetailsModal、TaskCard、TaskColumn、SideNavigation、Navigation、Settings、Statistics、CleanupModal、InitializationScreen、MilestonesPage、DraftsList、WikiDetail、DocumentationDetail、DecisionDetail、Modal、Toast、ErrorBoundary、HealthIndicator、LabelFilter、AcceptanceCriteria、DependencyInput、FilePreview、PasteAwareMDEditor、MermaidMarkdown。

## 实现挑战

- **C 盘空间不足（ENOSPC）**：`bun build --compile` 需要大量临时空间，通过清理 `%TEMP%` 和旧 `dist/` 构建解决
- **Settings 页面 i18n 滞后**：最初仅语言选择器被国际化，后续跟进将所有硬编码标签转换
- **Wiki 详情页对齐**：`Cancel`/`Edit` 按钮与占位文本统一使用 `t.common.*` 键

## 验证

- `bunx tsc --noEmit` passes
- `bun run check .` passes
- `bun run build` 生成包含嵌入翻译的工作二进制文件

## Related Concepts
- [[concepts/web-ui-i18n]] — 零依赖轻量级 i18n 架构详解
- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/web-server]] — Web Server API 与前端技术栈

## Related Sources
- [[sources/wiki-web-ui-task]] — BACK-473 Web UI Wiki 区域（部分组件重叠）
