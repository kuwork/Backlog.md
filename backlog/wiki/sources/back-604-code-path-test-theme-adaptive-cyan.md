---
title: BACK-604 - 同步 code-path 测试的青色断言
labels: [source, tui, tests]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-604 - Sync-code-path-styling-tests-with-theme-adaptive-cyan-color.md
---

# BACK-604 - 同步 code-path 测试的青色断言

BACK-518 把 TUI code-path 样式工具改为检测到的路径渲染青色而非灰色，但 `src/test/code-path.test.ts` 从未更新：六个测试仍断言 BACK-518 之前的灰色样式标签，在每次全量运行中确定性失败。本任务把期望同步到预期的主题自适应行为，未回退源码样式。

- `src/test/code-path.test.ts`：`styleCodePath` 与 `transformCodePaths` 两个套件共 16 处断言由 `{gray-fg}` 改为 `{cyan-fg}`，测试标题 "should wrap path in gray styling tags" 改名为 cyan。
- 未改源码；BACK-518 之后的主题自适应行为不动（灰色会违背既定渲染要求）。
- Scoped 测试 21/21 通过；全量运行显示六个 code-path 失败与两个 heading 失败（BACK-603）均消失（2045 pass / 13 fail，基线 20 fail）。

## 验收标准

- `styleCodePath` 与 `transformCodePaths` 测试对提取与就地样式路径期望 `{cyan-fg}` 标签。
- `bun test src/test/code-path.test.ts` 通过；改动文件 tsc 与 biome 干净。

## Related Concepts

- [[concepts/tui-theme-adaptive]] — 测试同步所依据的主题自适应样式契约（code path = 青色）。
- [[concepts/cli-tui]] — 被测的 TUI code-path 检测与样式工具。

## Related Sources

- [[sources/back-518-tui-theme-adaptive]] — 确立青色 code-path 样式的任务。
- [[sources/back-603-heading-test-theme-adaptive-gray]] — 同一清理波次的兄弟测试同步任务。
