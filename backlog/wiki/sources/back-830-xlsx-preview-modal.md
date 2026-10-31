---
title: BACK-830 - XLSX 电子表格高保真布局预览
labels: [source, web, docs, high-priority]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/tasks/back-830 - XLSX-spreadsheet-preview-with-high-fidelity-layout.md
---

# BACK-830 - XLSX 电子表格高保真布局预览

基于 Univer 开源 sheets 预设交付专用电子表格预览模态框 `XlsxPreviewModal`：保留让表格可读的布局——单元格文字与值、字体、填充、边框、对齐、合并区域、列宽、行高、数字格式。本任务吸收原 BACK-831（XLSX 编辑态），预览与编辑一并交付。

## 双模式

1. 默认只读查看态，带明确只读徽章；显示文件缓存的值，不重算。
2. 头部提供编辑入口；编辑态显示 Univer 功能区、公式栏、状态栏，徽章切到 edit mode。
3. 公式单元格在编辑态显示其公式（`cell.f` 随缓存值一起进模型）。
4. 编辑可保存：写回源 `.xlsx`/`.xlsm`；保存前先结束进行中的单元格编辑；无实际改动的保存如实报告而非报成功。
5. 退出编辑回到查看并重新从磁盘加载；未保存改动先确认。

## 模型与渲染

- 依赖 `@univerjs/presets` + 预设、`@univerjs/core`、SheetJS（`xlsx`，值/合并/尺寸/公式）、`jszip`（样式表与写回）。
- `xlsxStyleReader.ts` 用 JSZip 开包、解析 `xl/styles.xml`（numFmts/fonts/fills/borders/cellXfs），对默认 Office 调色板 + Excel 内置数字格式解析 rgb/theme+tint/indexed；每个工作表按单元格 `s` 索引取格式。社区 SheetJS 只暴露 `{patternType}`，字体/填充/边框/对齐/数字格式从包内读。
- `xlsxToUniverModel.ts` 用 SheetJS 读数、合并、!cols/!rows（须 `cellStyles:true` 才发），叠加格式图，发出 IWorkbookData：去重样式注册表、列宽 px（chars*7+5）、行高 px（pt*96/72）、Excel 默认 64px/20px、最小 80x16 网格。

## 保存为原地 OOXML 补丁

`applySnapshotToXlsxWithStats` 只重写被编辑工作表的 `<sheetData>` 与 `<mergeCells>`，其余条目（样式、主题、sharedStrings、media、drawings、图表、条件格式）逐字节拷贝。未改动单元格保留原始 XML 片段（公式感知比较：同公式文本保留原片段含 Excel 缓存值；真改的公式重写；无公式则回退缓存值比较）。服务端 `POST /api/xlsx/save`：项目根路径守卫、`.xlsx`/`.xlsm` 白名单、zip magic 校验、原子写（临时文件 + rename，EPERM/EACCES/EBUSY 短暂重试），被 Excel/WPS 占用时给通俗提示。

## 边界

- 值与新公式往返；编辑器内格式改动（粗体/填充/列宽/行高）不写回（无 Univer style→cellXfs 映射）。
- 图表、数据透视、迷你图、条件格式、图片、绘图不渲染但跨保存保留。
- 仅 `.xlsx`/`.xlsm`；编辑器内新增工作表不写回。Univer 重依赖进单一嵌入包（不代码分割）。
- 验证：8 个写回单测 + 真实 3 表/34 公式 workbook 的 zip 条目 diff 往返 + 运行 UI 视觉核对 + tsc/biome/build。

## Related Concepts

- [[concepts/file-preview]] — 文档预览家族，唯一带编辑/写回的双模式
- [[concepts/web-ui-features]] — 模态框与编辑态契约

## Related Sources

- [[sources/back-827-project-wide-docx-pdf-preview]] — 复用其链接拦截器与 `/api/raw-file`
- [[sources/back-829-pptx-preview-modal]] — 同族只读预览
- [[sources/back-831-localize-preview-modals]] — 四模态框本地化（含 Univer 功能区语言映射）
