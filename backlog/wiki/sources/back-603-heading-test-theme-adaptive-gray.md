---
title: BACK-603 - 同步 heading 测试的三级灰色断言
labels: [source, tui, tests]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-603 - Sync-heading-component-tests-with-theme-adaptive-level-3-color.md
---

# BACK-603 - 同步 heading 测试的三级灰色断言

BACK-518 把 TUI heading 组件改为三级标题渲染灰色而非白色（主题自适应渲染的一部分），后续主题自适应工作保留了该行为，但 `src/test/heading.test.ts` 从未更新。两个测试仍断言 BACK-518 之前的白色，在每次全量运行中确定性失败。本任务把测试期望同步到预期行为，未改源码颜色。

- `src/test/heading.test.ts`：三级 `getHeadingStyle(3)` 期望由 white 改为 gray，三级 `formatHeading` 期望由 `{white-fg}` 改为 `{gray-fg}`。
- 有意不改源码：白色会违背 BACK-518 确立并被后续任务保留的主题自适应渲染要求。
- Scoped 测试 11/11 通过；全量运行确认两个 heading 失败不再出现（2039 pass / 19 fail，其余失败均为已知不相关债务/不稳定项）。

## 验收标准

- `getHeadingStyle(3)` 测试期望 gray；`formatHeading` 三级测试期望 `{gray-fg}` 标签。
- `bun test src/test/heading.test.ts` 通过；改动文件 tsc 与 biome 干净。

## Related Concepts

- [[concepts/tui-theme-adaptive]] — 测试同步所依据的主题自适应颜色契约（三级 = 灰色）。
- [[concepts/cli-tui]] — 被测的 TUI heading 组件渲染。

## Related Sources

- [[sources/back-518-tui-theme-adaptive]] — 确立三级标题灰色行为的任务。
- [[sources/back-565-tui-theme-adaptive-scroll]] — 保留该行为的后续主题自适应工作。
