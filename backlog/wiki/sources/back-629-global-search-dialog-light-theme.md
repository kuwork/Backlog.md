---
title: BACK-629 Fix global search dialog not following the light theme
created_date: '2026-09-26 16:30'
updated_date: '2026-09-26 16:30'
labels:
  - source
  - web-ui
  - theming
source_path: backlog/tasks/back-629 - Fix-global-search-dialog-not-following-the-light-theme.md
---

# BACK-629 Fix global search dialog not following the light theme

BACK-624 交付的全局搜索对话框在亮色主题下仍然是暗的——用户无法把它切到亮色。本任务把 `src/web/components/search/SearchDialog.tsx` 里全部 surface class 改写为「亮色类 + `dark:` 变体」对，暗色渲染逐项保持不变。

## Summary

- 根因：所有颜色类都是 dark-first——面板 `bg-gray-900`、输入 `text-gray-100`、选中行 `bg-gray-700/70`、过滤 tab `bg-gray-700`、类型图标 `text-*-400`、关键词高亮 `bg-amber-400/25 text-amber-100`——既没有亮色对应项也没有 `dark:` 变体，于是主题切换对对话框无效
- 修法（单文件、只改 class，不动逻辑/路由/i18n）：面板 `bg-white dark:bg-gray-900`、边框 `border-gray-200 dark:border-gray-700`、输入 `text-gray-900 placeholder-gray-400 dark:text-gray-100 dark:placeholder-gray-500`、选中行 `bg-gray-100 dark:bg-gray-700/70` + `border-blue-500 dark:border-blue-400`、hover `bg-gray-50 dark:bg-gray-700/40`、激活 tab `bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100`、类型图标 `text-*-600 dark:text-*-400`、高亮 `bg-amber-200/70 text-amber-900 dark:bg-amber-400/25 dark:text-amber-100`、loading chip `bg-white/80 dark:bg-gray-900/80`、错误 `text-red-600 dark:text-red-400`；窄屏全屏面板同样 `bg-white dark:bg-gray-900`
- backdrop（`bg-black/40 dark:bg-black/60`）本来就是主题感知的，未改动
- 验证走真实浏览器（`bun src/cli.ts browser --port 6611 --no-open` + Chromium 驱动）读 computed 样式取证：亮色下对话框背景 `rgb(255,255,255)`、输入 `oklch(0.21…)`（gray-900）、选中行 blue-500 边框 + gray-100 底、高亮 amber-200/70；暗色下逐项与修复前一致；对话框开着切换 `documentElement` 的 dark class 立即翻转、无需重载；500px 窄屏亮色为全屏白面板
- 门禁：`bunx tsc --noEmit` 通过；`bun run check .` 3 条既有 warning 无 error（`biome.json` 忽略 `src/web`，本文件不在 lint 范围）；`bun test src/web/utils/search-results.test.ts` 31 pass / 0 fail
- 本页为 2026-09-26 batch-ingest 的**补录**：该波把 629 误记为 ID 跳号而漏摄取（见 `log.md` 数据异常记录的更正）

## Acceptance Criteria

- 亮色主题下面板、输入、行、过滤 tab 与分组头全部亮底深字，对话框内不留暗色 surface
- 暗色主题下逐项保持原样（面板 gray-900、浅字、选中行 gray-700/70 + blue-400 强调）
- 打开对话框时切换主题双向立即生效，无需重载
- 窄视口（<640px）同样渲染亮色全屏对话框
- `bunx tsc --noEmit` 与 `bun run check .` 对触碰文件通过

## Related Concepts

- [[concepts/web-ui-features]] — 全局搜索对话框所在的 Web UI 交互层
- [[concepts/browser-loading]] — loading chip 等异步态同样要求主题感知

## Related Sources

- [[sources/back-624-global-search-dialog]] — 引入该对话框并被本任务修复的前置任务
- [[sources/back-664-dependency-input-completed-predecessors]] — 把 BACK-629/BACK-624 当作 completed 依赖的实时联调对象
