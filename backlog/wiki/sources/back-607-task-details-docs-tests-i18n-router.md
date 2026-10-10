---
title: BACK-607 - 任务详情文档测试包裹 I18nProvider 与 MemoryRouter
labels: [source, web-ui, tests]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-607 - Wrap-task-details-documentation-tests-with-I18nProvider-and-MemoryRouter.md
---

# BACK-607 - 任务详情文档测试包裹 I18nProvider 与 MemoryRouter

web i18n 支持落地后，`TaskDetailsModal` 需要 `I18nProvider` 与路由上下文，但 `src/test/web-task-details-modal-documentation.test.tsx` 中两个 'Web task popup documentation display' 测试只在 `ThemeProvider` 内渲染，渲染时抛错并确定性失败。本任务按同级 final-summary 测试相同的 provider 组合包裹渲染，并更新一处陈旧的空状态断言。

- `src/test/web-task-details-modal-documentation.test.tsx` 的两处渲染现经共享 `renderModal` helper 用 `MemoryRouter` + `I18nProvider` + `ThemeProvider` 包裹 `TaskDetailsModal`，与 `web-task-details-modal-final-summary.test.tsx` 一致；其余测试断言不变。
- 调查发现：第二个测试期望 Documentation 区为空时隐藏，但 BACK-479 有意使其始终可见（添加表单 + 空占位，与 References 同模式）。陈旧断言改为检查占位渲染而非分区缺席。
- Scoped 测试 2/2 通过；全量运行确认两个文档展示失败消失且无新增失败。

## 验收标准

- 两个文档展示测试以 I18nProvider 与 MemoryRouter 渲染并通过。
- 空状态测试断言始终可见的文档分区渲染其空占位，与 BACK-479 编辑 UI 一致。

## Related Concepts

- [[concepts/web-ui-i18n]] — web i18n 落地后 I18nProvider 成为渲染 web 组件的硬性要求。
- [[concepts/web-ui-features]] — TaskDetailsModal 的 provider 依赖（i18n + 路由）与始终可见的 Documentation 分区。

## Related Sources

- [[sources/back-604-code-path-test-theme-adaptive-cyan]] — 同一全量测试清理波次的兄弟确定性测试修复任务。
