---
title: BACK-838 - Office 链接页范围与工作表范围
labels: [source, web-ui, markdown, office, i18n, high-priority]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/tasks/back-838 - Support-Office-page-and-sheet-ranges-in-Markdown-links.md
---

# BACK-838 - Office 链接页范围与工作表范围

此前 Markdown 里的 Office 链接只能打开整篇文档，无法指向报告第 1-4 页、演示第 3-8 张或工作簿某张表；指向文档的 Markdown 图片还会掉进图片 lightbox 渲染成空白。渲染期 join 又把 `report.docx:P1-P4` 当成不透明 URI scheme，塌成死 `#` 锚点。

## 语法契约

`parseOfficeLink` 把 `<path>.<office-ext>:<token>` 拆成干净路径、文件种类与 `pages` / `sheets` 范围：

| 文件 | 合法 token | 语义 |
|---|---|---|
| docx / pptx / pdf | `:P1`、`:P1-P4` | 页窗口，**`P` 前缀强制** |
| xlsx / xlsm | `:p1`、`:p1-p2`（1-based）、`:表名` | 工作表序号或中文表名 |
| 其它文本 | `:3-7` | 仍是**纯文本行范围**，绝不解释为页 |

`P` 必须存在，正因为去掉它会让文档夺走 `:1-4` 已有的「文本行」含义。工作簿的百分号编码表名在交给 Univer 前解码一次；`kindFromName` 容忍 `:range` 后缀，避免带空格的表名遮住真实扩展名。

## 四个 viewer 的落地

- **docx**：定位 `.layout-page` 到编辑器滚动容器，带有限重试以挺过迟到的重排 —— 库自带 `scrollToPage` 瞄的是它自己的容器，不是模态框滚动的那个，单调用会停在第 1 页。
- **pdf**：只渲染请求的页窗口，越界请求 clamp 到 `numPages`，并把实际页数回报给徽标（3 页 PDF 上 `:P9-P12` 显示「第 3 页」）。
- **pptx**：投影 clamp 后的 `slideWindow`，因为渲染器懒挂载幻灯片，用 `MutationObserver` 隐藏窗口外 `[data-slide-index]`；缩略图条与放映计数同步收窄。
- **xlsx**：`setActiveSheet(string)` 要的是 sheet **id** 而不是名字，序号与名字 token 都先解析成 `FWorksheet` 再激活，带有限重试。

`officeRangeLabel` 统一生成四种 viewer 与内联嵌入的徽标，文案在 en / zh-CN / zh-TW / ja 四语言里（`preview.shared.pageSingle/pageRange`、`preview.xlsx.sheetIndex/sheetRange/sheetName`）。

## 内联嵌入与最后一公里

指向 Office 的 Markdown **图片**改由 `OfficeEmbedInline` 在 `<figure>` 里内嵌同一 viewer，图注是干净文件名 + 范围徽标，`alt` 描述性文字降级为 tooltip，避免「报告 第 1-2 页」与徽标重复。非 Office 图片继续走 lightbox。

真正的 404 根因在 `Layout.tsx` 的**document 级 capture-phase 拦截器**：它先于所有 Markdown handler 运行并 `stopPropagation`，却把原始 `href` 直接拼成 `/api/raw-file?path=...docx:P1-P4`，于是每个带范围的链接都 404，标题还把范围一起带上。改为走 `parseOfficeLink` + `binaryOfficeFileProps`、范围单列 state、标题用干净文件名后，用户测试报的两个问题（全部范围预览 404、徽标与标题重复）同时消失。

## 验收 fixture

`doc-35` 放在 `backlog/docs/PRDS/OfficeLinkCheck/`，通过站点根 `/quickstart/` 引用仓库根的四个真实文件（Word 约 300 段 13 表、PPTX 12 张、PDF 3 页、XLSX 四张中文表），含一条相对路径对照、裸数字反例、普通图片 lightbox 对照。

## 验证

`tsc --noEmit`、Biome、`bun run build` 通过；4 个套件 122 个测试（`--timeout 30000`）。Headless Chrome 对四个真实文件确认无 4xx、标题干净且只有一枚徽标、docx `:P2` 定位第 2 页、pptx `:P2-P5` 计数 1/4、pdf `:P9-P12` clamp 到第 3 页、xlsx 序号与中文表名各自激活正确工作表。两份 guideline 文档同步记录了 Office 链接语法。

## Related Concepts

- [[concepts/file-preview]] — 四个 Office 模态框与范围预览
- [[concepts/markdown-pipeline]] — 扩展名锚定的范围判定与 join
- [[concepts/relative-reference-resolution]] — 相对 Office 目标在 join 后保留范围

## Related Sources

- [[sources/back-825-word-document-preview-modal]] — Word viewer 基础
- [[sources/back-828-pdf-preview-modal]] — PDF viewer 基础
- [[sources/back-829-pptx-preview-modal]] — PPTX viewer 基础
- [[sources/back-830-xlsx-preview-modal]] — XLSX viewer 基础
- [[sources/doc-35-office-link-check]] — 四格式验收 fixture
