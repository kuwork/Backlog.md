---
title: BACK-825 - Word 文档预览与内联编辑模态框
labels: [source, web, docs]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/tasks/back-825 - Word-document-preview-and-inline-editing-modal.md
---

# BACK-825 - Word 文档预览与内联编辑模态框

基于 docx-editor 交付专用 Word 预览模态框 `DocPreviewModal`：真实分页 A4 页面、中性背景。默认只读预览；Edit 进入编辑态（工具栏、页边距参考线、标尺）；Save 经确认守卫写回源文件；Exit edit 回到预览。

## 要点

- 头部显式展示模式徽章（与表格预览一致）：只读态灰色 `read-only preview`，编辑态蓝色 `edit mode`，状态不靠外观推断。
- 支持 CSS 全屏填充视口；模态内容裁切到圆角，无额外页边距。
- 四语言本地化（en/ja/zh-CN/zh-TW）：自构建 zh-TW 与 ja 覆盖包，缺失键回退英文（`PartialLocaleStrings`）。
- 全局拦截 `/assets/*.docx` 链接改为打开预览模态框而非下载。

## 实现

- 新增 `binaryOfficeFile` 共享助手（`kindFromName`、`isBinaryOfficeFile`、`binaryOfficeFileProps`）。
- `DocPreviewModal` 用 `React.lazy` 加载 docx-editor，i18n 经 `key={locale}` 重挂载（i18n 在挂载时读取）；查看/编辑双模式；经 `POST /api/docx/save` 写回，服务端带路径穿越守卫 + `Bun.write`。
- `Modal` 增加 fullscreen / noPadding 以圆角裁切；jszip 别名到 `dist/jszip.min.js` 绕过 readable-stream 的 require 阻塞；docx-editor 代码分割，不进初始包。

## 验证

`tsc --noEmit`、biome、`bun scripts/build.ts` 均通过；四语言下预览/编辑/保存在运行 Web UI 验证。

## Related Concepts

- [[concepts/file-preview]] — 同渲染链下的文档预览家族
- [[concepts/web-ui-features]] — Web UI 模态框体系

## Related Sources

- [[sources/back-826-non-previewable-office-notice]] — 不支持格式的提示分支
- [[sources/back-827-project-wide-docx-pdf-preview]] — 解除 /assets/ 限制，项目任意路径预览
- [[sources/back-831-localize-preview-modals]] — 四个预览模态框本地化
