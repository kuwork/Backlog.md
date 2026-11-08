---
title: BACK-835 - 统一 Markdown 相对引用解析
labels: [source, web-ui, markdown, core, server, high-priority]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/tasks/back-835 - Unify-Markdown-relative-reference-resolution.md
---

# BACK-835 - 统一 Markdown 相对引用解析

Web Markdown 里的相对引用原先被浏览器、文件预览 API、wiki 层用**三套不同的基准**解析。本任务把它们收敛为统一的「渲染期 join + 服务端 try_files」两阶段契约，让与数据目录同级的兄弟目录（Markdown、代码、图片、Office 二进制）都能预览。

## 两阶段解析

1. **渲染期**：每个本地 `href`/`src` 与「当前文档所在目录」做 POSIX join，结果作为站点绝对 URL 直接写进 HTML 标签。以 `/` 开头的目标属于 URL／路由层，**永不参与 join**；外链、`#` 锚点、实体短链原样放行。可选的 `:N` / `:N-M` 行范围先剥离再回挂。
2. **服务端**：注册路由优先；未命中的 GET 落到唯一一个 nginx 风格 `try_files` 处理器，按「项目根目录 → 配置的数据目录 → 其 assets 目录」的有序候选表，流式返回第一个存在的文件。

## 关键契约

- **包含边界是项目根目录，不是数据目录**：多级 `../` 只要结果仍在根内就允许；越界在渲染期与服务端各拒绝一次。`reference-paths.ts` 用 `relative()` + `isAbsolute()`（而非 `startsWith`）判定，并拒绝 realpath 逃逸的符号链接。
- **单一解析器**：`/api/file-content` 与 `/api/raw-file` 都调用 `CoreFileSystem.readProjectAsset`。raw-file 的守卫从硬编码数据目录放宽到项目根，故 `backlog/` 外的 docx/pdf/pptx/xlsx 也能在应用内预览。
- **元数据与正文分道**：Markdown 正文引用相对**所在文档**解析且可到达兄弟目录；`--ref`/`references`、`modifiedFiles`、文档路径、查询块 `source` 仍是**项目根相对**。自定义数据目录名被 join 与候选表同时尊重，没有新增硬编码 `backlog/` 前缀。
- **安全**：5MB 上限、非目录文件、扩展名 + MIME 白名单、排除 `.git`/`.env`/`.temp`、`nosniff`、svg/html 走 attachment disposition；`/api/preview` 的 wiki id 与 `/assets/*` 同样用 `isInsideProject`。

## 连带修复

- 文档 API 原先只返回相对 `<data-dir>/docs` 的 `path`，深度不足以让 `../` 抵达兄弟集合；现额外派生 `projectPath`，`DocumentationDetail` 用它作渲染基准，存储路径不变。
- 修掉 `MermaidMarkdown.tsx` 的 `??` 运算符优先级 bug，代码围栏保护范围才计算正确。
- 编辑态 prism 只认不含空格的目标，含空格的链接显示为纯文本；新增幂等 `mdlink` token 覆盖尖括号 `<...>` 与裸空格目标，`source.css` 染成与渲染态一致的蓝色。

## 边界与遗留

CLI / MCP 输出原始 Markdown，不在范围内。任务**刻意不修改 `backlog/wiki/` 下任何文件**，并在 Implementation Notes 里点名 5 处仍描述旧契约的 wiki 页面（`concepts/file-preview`、`concepts/web-server`、中英文 `12-文档预览` 手册、`sources/back-827...`），留作单独批准的后续变更 —— 由 2026-11-08 的 wiki 摄取完成。

## 验证

`tsc --noEmit`、Biome 通过；4 个套件 45 个测试（含渲染 HTML、路由优先级、候选顺序、根目录逃逸、多级父目录、编码文件名、自定义数据目录、跨目录 Office 预览、敏感/超大文件拒绝）以 `--timeout 30000` 通过。doc-34 四条相对链接在查看态解析到真实项目路径、编辑态四条均显示蓝色。

## Related Concepts

- [[concepts/relative-reference-resolution]] — 两阶段解析、边界与元数据/正文分道
- [[concepts/file-preview]] — 引用字段与正文链接的新路径契约
- [[concepts/markdown-pipeline]] — 渲染期 join 与编辑态高亮
- [[concepts/web-server]] — try_files 回退与共享解析器

## Related Sources

- [[sources/back-836-decision-relative-reference-resolution]] — 同一边界转换推广到 decision
- [[sources/back-837-wiki-relative-references-entity-links]] — 推广到 wiki 与实体链接
- [[sources/back-827-project-wide-docx-pdf-preview]] — 被本任务取代的旧路径契约
- [[sources/doc-34-relative-link-check]] — doc 侧验收 fixture
