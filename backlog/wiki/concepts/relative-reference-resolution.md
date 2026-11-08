---
title: 相对引用解析
labels: [concept, markdown, web-ui, core, server, m-19]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
---

# 相对引用解析

Web 端 Markdown 里的本地链接 / 图片如何找到磁盘文件，曾由浏览器、`/api/file-content`、wiki 层各按各的基准解析。BACK-835 把它收敛成一条统一契约，BACK-836/837 再补齐 decision 与 wiki 两个集合的边界。这是 [[concepts/file-preview]] 与 [[concepts/markdown-pipeline]] 共同依赖的底层规则。

## 两阶段解析

| 阶段 | 负责 | 行为 |
|---|---|---|
| 渲染期 join | `src/web/utils/markdown-paths.ts` | 每个本地 `href`/`src` 与**当前文档所在目录**做 POSIX join，结果作为站点绝对 URL 写进 HTML 标签 |
| 服务端 try_files | `src/file-system/reference-paths.ts` + `operations.ts` | 注册路由优先；未命中按「项目根 → 配置数据目录 → 其 assets」有序候选表返回第一个存在的文件 |

以 `/` 开头的目标属于 **URL / 路由层，永不 join**（`/documentation/26:10-50`、`/quickstart/report.pdf`、外链、`#` 锚点同理放行）。`:N` / `:N-M` 行范围先剥离再回挂。`/api/file-content` 与 `/api/raw-file` 共用 `CoreFileSystem.readProjectAsset` 一个解析器。

## 包含边界：项目根，不是数据目录

多级 `../` 只要结果仍在项目根内就允许，因此能到达与数据目录同级的兄弟目录（`src/`、`quickstart/`、`scripts/`）。越界在渲染期和服务端各拒一次。`isInsideProject` 用 `relative()` + `isAbsolute()` 而非 `startsWith`，并拒绝 realpath 逃逸的符号链接。`readProjectAsset` 另施 5MB 上限、非目录文件、扩展名 + MIME 白名单、排除 `.git`/`.env`/`.temp`、`nosniff`、svg/html 的 attachment disposition。

## 元数据与正文必须分道

| 位置 | 基准 |
|---|---|
| Markdown 正文的 href/src | 相对**所在文档**，可到兄弟目录 |
| `--ref` / `references` / `modifiedFiles` / 文档路径 / 查询块 `source` | **项目根相对**，始终不变 |

混淆两者是最常见的回归来源。自定义数据目录名被 join 与候选表同时尊重，实现里没有新增硬编码 `backlog/` 前缀。既有的 `assets/...` 链接、粘贴的 `/assets/paste/...` 图片、`/documentation/10:55-74` 全部无需内容迁移。

## 集合边界转换：projectPath

API 存的是**集合内相对**路径（doc 相对 `<data-dir>/docs`、decision 甚至是裸文件名、wiki 相对 wiki 目录），深度不足以让 `../` 爬到兄弟集合。三个集合各自在 API 边界派生项目相对基准，存储值一律不变：

| 集合 | 派生字段 | 任务 |
|---|---|---|
| doc | `projectPath` | BACK-835 |
| decision | `projectPath`（列表端点原先连 `path` 都不返回） | BACK-836 |
| wiki | `projectPath` + `wikiRoot` | BACK-837 |

`collectionProjectPath` = `relative(rootDir, collectionDir)` + 集合内相对路径。没有这一步，`../wiki/concepts/auto-port.md` 会被判为根逃逸、塌成死 `#` 锚点。

## wiki 根分流

join 完成后，只有**仍在 `wikiRoot` 内且是 markdown-ish 目标**（无扩展名 / `.md` / `.markdown`）变成 `/wiki/<page>:range`；docs、decisions、assets、图片与其它扩展名保持项目文件 URL。`splitTarget` 只在文件扩展名之后切 `:N-M`，所以文件名里的 ASCII 或全角冒号不会被误判为范围。`sanitizeRawHtmlAngleBrackets` 保护 `](<...>)`，避免 `</backlog/...>` 被当成闭合标签转义。

## 点击契约

`useMarkdownLinkPreview` + `MarkdownPreviewModal` 是 doc / decision / wiki / task / milestone / memo 共用的单一来源：本地文件与 Office 打开预览、带范围实体链接打开区间预览、普通实体链接导航、`/decision/:id` 视作 `/decisions/:id` 别名。wikilink 与显式 `/wiki/...` Markdown 链接按来源分流 —— wikilink 走内联弹窗（含 `:N-M` 局部加载），显式链接走 SPA 导航；带范围链接一律留弹窗，因为 wiki 路由没有行范围段。

## 编辑态

composer prism 只认不含空格的目标，故叠加两个幂等 overlay token：`mdlink`（含空格 / 尖括号 / 空标签 Markdown 目标）与 `wikilink`（`[[...]]`）。六个可含 wikilink 的编辑器表面传 `wikilinkBasePath`。带空格目标用 `encodePath` 每段「先解码一次再编码」，避免 `%20` 二次编码成 `%2520`。

## Related Concepts

- [[concepts/file-preview]] — 四 Office viewer 与范围预览
- [[concepts/markdown-pipeline]] — 渲染期预处理与编辑态高亮
- [[concepts/web-server]] — try_files 路由与共享解析器
- [[concepts/wikilink]] — wiki 内部链接语法

## Related Sources

- [[sources/m-19-fix-relative-reference-resolution]] — 里程碑
- [[sources/back-835-unify-relative-reference-resolution]] — 主实现
- [[sources/back-836-decision-relative-reference-resolution]] — decision 边界
- [[sources/back-837-wiki-relative-references-entity-links]] — wiki 分流
- [[sources/back-838-office-page-sheet-ranges]] — 范围 token 语法
- [[sources/doc-34-relative-link-check]] / [[sources/decision-2-relative-link-check]] / [[sources/doc-35-office-link-check]] — 验收 fixture
