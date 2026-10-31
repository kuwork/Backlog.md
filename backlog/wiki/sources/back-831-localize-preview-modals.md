---
title: BACK-831 - 本地化四个文档预览模态框
labels: [source, web-ui, i18n]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/tasks/back-831 - Localize-the-four-document-preview-modals.md
---

# BACK-831 - 本地化四个文档预览模态框

把应用切到英文后，DOCX/PPTX/XLSX/PDF 四个预览模态框仍全是中文——约 60 行 CJK 字面量硬编码，无视活动语言。本任务把所有用户可见文案移入翻译字典。

## 策略

1. 全部可见文案入字典：按钮、tooltip、aria-label、确认/警告对话框、加载/错误态、只读/编辑徽章、PPTX 大纲与播放器 chrome、PDF 大纲面板。
2. 动态串用占位模板（`pageOfPages`、`slideIndex`、`saveFailed`、`renderFailed`）而非拼接。
3. 复用优先：`common` 已含 save/saving/edit/close/cancel/loading/retry/expand/collapse/confirm/failedToLoad/failedToSave/unsavedChanges，这些从 `common` 读而非重定义；`fullscreen`/`exitFullscreen` 从 memos 与 graph pane 两处提升（promote）到 `common` 而非再加副本；仅 `common` 没有的进新 `preview` 命名空间（shared + 每格式 docx/pptx/xlsx/pdf）。
4. `en.ts` 为单一事实源；zh-CN/zh-TW/ja 同批补全；`TranslationDict` 派生于 en.ts，缺键即编译错误。
5. 文档内容、模态框标题里的文件名、docx-editor 自带 UI 不在范围（后者自理 locale）。

## 实现

- `PPTX` 播放器提示列物理键（Space/arrows/Home/End/Esc）整句翻译而非代码中拼接键名（词序因语言而异）。
- `XLSX` 需第二翻译：Univer 工作台原本硬编码 ZH_CN，现映射 app locale 到 Univer 自有包（en→enUS、ja→jaJP、zh-CN→zhCN、zh-TW→zhTW），并把 `locale` 加入 viewer effect 依赖，切换语言即重建实例；多引入约 1.9 MB 二进制。

## 验证

四个组件 CJK grep 仅剩注释；tsc、biome（10 文件）、`bun run build`（181.8 MB）、既有 `xlsxSnapshotWriter` 8 测通过。

## Related Concepts

- [[concepts/web-ui-features]] — 国际化体系
- [[concepts/file-preview]] — 文档预览家族

## Related Sources

- [[sources/back-825-word-document-preview-modal]]
- [[sources/back-828-pdf-preview-modal]]
- [[sources/back-829-pptx-preview-modal]]
- [[sources/back-830-xlsx-preview-modal]]
