---
title: BACK-844 - 韩语成为第五种 Web UI 语言
labels: [source, web-ui, i18n]
created_date: 2026-11-10 00:27
updated_date: 2026-11-10 00:27
source_path: backlog/tasks/back-844 - Add-Korean-ko-as-the-5th-web-UI-locale.md
---

# BACK-844 - 韩语成为第五种 Web UI 语言

Web UI 原有四种语言（en / ja / zh-CN / zh-TW）。本任务补齐韩语 ko，使韩语环境用户获得完整本地化体验，覆盖主字典、语言选择器、默认状态机、电子表格预览与 DOCX 编辑器外壳。

## 目标

- `ko` 进入 `Locale` 联合类型、字典表、`DEFAULT_STATE_MACHINES` 与 `isValidLocale`。
- 设置页语言下拉出现 `한국어`。
- `detectDefaultLocale` / `defaultStateMachineForLocale` 把 `ko*` 映射到 `ko`。
- XLSX 预览接 Univer 的 `ko-KR` 语言包，DOCX 编辑器外壳有韩语文案。
- 五个字典的键结构仍由 `TranslationDict` 编译期强制一致。

## 实现要点

| 面 | 改动 |
|---|---|
| 主字典 | 新增 `src/web/locales/ko.ts`，完整 `TranslationDict`（1421 行）+ 韩语 `defaultStateMachine` |
| 注册 | `src/web/locales/index.ts` 四处登记；`Settings.tsx` 下拉加 `한국어` |
| 状态机 | `src/core/state-machine.ts` 按 `ko*` 前缀识别并回落到 ko 默认状态机 |
| XLSX | `XlsxPreviewModal.tsx` 经 `LocaleType.KO_KR` 接 Univer 语言包 |
| DOCX | 新增 `src/web/locales/docx/ko.ts` 并在 `DocPreviewModal.tsx` 注册 |

**DOCX 只能做部分覆盖**：`@eigenpal/docx-editor-i18n` 只发布 en/de/fr/he/hi/id/pl/pt-BR/tr/zh-CN，没有韩语。项目自持 `PartialLocaleStrings` 深合并到包内 en 字典，缺键回落英语；ja 与 zh-TW 原本就是这个形态，ko 照此补齐（880 行）。

**状态名刻意保留英文**：沿用既有 zh-CN / ja 约定，只把 `when` / `if` / `requires` / `evidence` 的散文本地化，避免状态机字符串被翻译后破坏持久化数据的比较逻辑。

## 验证

`bunx tsc --noEmit`、`biome check` 通过；三个遍历语言的测试（`state-machine.test.ts`、`office-range-label.test.ts`、`web-initialization-cursor.test.tsx`）同步更新并通过。References 使用无行号的项目根相对路径。

## Related Concepts

- [[concepts/web-ui-i18n]] — `TranslationDict` 编译期强制、字典命名空间与语言注册
- [[concepts/file-preview]] — DOCX / XLSX 两个预览模态框的本地化挂载点

## Related Sources

- [[sources/back-831-localize-preview-modals]] — 四个预览模态框的本地化先例
- [[sources/back-834-consolidate-query-block-i18n]] — 查询块 i18n 字典合并
- [[sources/web-ui-i18n-task]] — BACK-478 建立的 i18n 底座
