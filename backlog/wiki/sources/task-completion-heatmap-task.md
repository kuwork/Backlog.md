---
title: BACK-503 统计页面 GitHub 风格贡献热力图
labels: [source, feature, web-ui, statistics, visualization]
created_date: 2026-05-31 01:11
updated_date: 2026-05-31 01:11
source_path: backlog/tasks/back-503 - Task-completion-in-the-last-year.md
---

# BACK-503 统计页面 GitHub 风格贡献热力图

## Summary

在 Web UI Statistics 页面顶部添加 GitHub 风格的贡献热力图，展示过去一年每天完成的任务数量。同时建立了服务端统计缓存架构，支持 CLI 创建任务后统计数据的自动刷新。

## Key Requirements

- **热力图**: 7 行 × 53 列网格，周日开始，CSS Grid `repeat(53, 1fr)` 填充容器
- **颜色**: GitHub 官方色板，light `#ebedf0`→`#216e39`，dark `#161b22`→`#39d353`，使用 inline `style`（Bun CSS build 在 Windows 上崩溃）
- **Tooltip**: hover/click 双状态，显示 YYYY-MM-DD 日期和完成数
- **i18n**: 4 语言支持，英文 pluralization（0/1/N tasks）
- **服务端缓存**: `cachedStatisticsResponse` + 500ms debounce `invalidateStatistics()`，ContentStore 变更触发自动刷新，WebSocket 广播 `"statistics-updated"`
- **客户端缓存**: `localStorage` 瞬时加载，监听 WebSocket 事件

## Architecture Changes

### Backend (`src/server/index.ts`)
- `invalidateStatistics()`: 标记 dirty、清空缓存、500ms 后重新计算
- `recomputeAndBroadcastStatistics()`: 获取 snapshot → `getTaskStatistics()` → JSON 序列化 → 广播 `"statistics-updated"`
- `handleGetStatistics()`: 优先返回缓存，无缓存时即时计算

### Frontend (`src/web/components/Statistics.tsx`)
- `ContributionGraph` 子组件，接受 `data` 和 `total` props
- `hoveredCell` / `clickedCell` 独立状态管理 tooltip
- 月标签基于 `locale` 本地化

## Bugs Discovered & Fixed

### Bug 1: 统计缓存不自动刷新
- **根因**: `invalidateStatistics()` 未在所有 ContentStore 事件类型中调用；`getTaskStatistics()` 中的 `[heatmap]` debug `console.log` 阻塞事件循环
- **修复**: 在 `ensureServicesReady()` subscribe 回调中对所有事件调用 `invalidateStatistics()`；移除 debug 日志

### Bug 2: i18n locale 切换回退到中文
- **根因**: `App.tsx` 的 `loadAllData()` 每次被调用都无条件执行 `setLocale(configData.locale)`，覆盖用户手动选择
- **修复**: 仅首次加载时同步 locale：`if (isFirstLoad && configData.locale ...)`

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 页面与技术特性总览
- [[concepts/web-server]] — Web Server API 与实时同步
- [[concepts/web-ui-i18n]] — 国际化方案
- [[concepts/project-health]] — 项目健康度指标

## Related Sources
- [[sources/back-490-overview-command-task]] — BACK-490 CLI 统计命令
- [[sources/back-489-health-indicators-task]] — BACK-489 健康指标重构
