---
title: BACK-837 - Wiki 相对引用与实体链接
labels: [source, web-ui, markdown, wiki, wikilink]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/tasks/back-837 - Support-wiki-relative-references-and-entity-links.md
---

# BACK-837 - Wiki 相对引用与实体链接

wiki 页原先传 wiki 目录内相对的 `page.path` 作渲染基准，`../` 会被 BACK-835 判为项目根逃逸；同时 wiki 缺 BACK-836 的共享点击契约，`/documentation/...`、`/decisions/...`、`/wiki/...` 要么丢行范围、要么被页面本地 click handler 吞掉。本任务一并收口，并把此前 stash 的 wikilink 草稿完整落地。

## 边界与分流

- `/api/wiki/:path` 新增 `projectPath` 与 `wikiRoot`（项目相对集合根），持久化的 `path` 不变；`FileSystem.wikiDir` 用新增的 `DEFAULT_DIRECTORIES.WIKI` 常量。`wiki_output/` 回退分支按数据目录解析，故标注为 `backlogDir` 而非 wiki 目录。
- `markdown-paths.ts` 用 `MarkdownJoinOptions.wikiRoot` 取代此前 stash 的布尔 wiki 模式：**join 后仍在 wiki 根内、且是 markdown-ish 目标**（无扩展名 / `.md` / `.markdown`）才变成 `/wiki/<page>:range`；docs、decisions、assets、图片与其它扩展名保持项目文件 URL。没有 wikiRoot 时行为与 BACK-835 完全一致。
- `splitTarget` 只在**文件扩展名之后**切 `:N-M`，ASCII 或全角冒号落在文件名里不会被误认成范围；`sanitizeRawHtmlAngleBrackets` 现在保护 `](<...>)`，否则 `</backlog/docs/report.md>` 会被当成闭合标签转义。

## 点击契约：wikilink 与显式 /wiki 路由分流

删掉 `WikiDetail` 两个 DOM 级 click handler（它们先于 React 委派 handler 运行，导致 `/task/` 双重导航、`/wiki/` 既导航又弹窗、带范围文档链接丢范围）。全页与 wiki 预览弹窗统一由 `useMarkdownLinkPreview` 驱动，`onWikiClick` 覆盖为打开 `WikiLinkPreview`（`:N-M` 只加载对应行）。

后续细化按来源分流：`[[...]]` wikilink（带 `data-wikilink="true"`）保持内联弹窗 + 局部行加载；**显式 Markdown 写的 `/wiki/...` 链接走 SPA 导航**切换页面。带范围的链接无论来源都留在弹窗，因为 wiki 路由没有行范围段（导航到 `/wiki/page:3-8` 会 404）。`parseLocalUrl` 接受 `/decision/:id` 作为 `/decisions/:id` 的别名。

## 编辑器与验收 fixture

`PasteAwareMDEditor` 接 `wikilinkBasePath`，注册幂等 `wikilink` overlay token、注入 `createRemarkWikilink` 预览插件并标记 `wikilink-aware`；wiki / 文档 / 决策 / 任务 / 里程碑 / memo 六个表面启用。既有的 `mdlink` overlay 与空标签分支不动。

新增 `backlog/wiki/test/back-837 - Link-Check.md` 与带空格的 `Another Page.md`，配合 doc-34、decision-2 构成 wiki ↔ doc ↔ decision 三向验证。验收时发现二次编码缺陷：composer 先把尖括号目标写成 `%20`，`encodeWikiPath` 又编一次，带空格的兄弟页变成 `/wiki/test/Another%2520Page.md`；wiki 分支改用 `encodePath`（每段先解码一次再编码）修复。

## 验证

7 个套件 188 个作用域测试（`--timeout 30000`）；`tsc --noEmit`、Biome 干净。全新构建下五个带空格目标从 `/api/file-content` 返回 200；CDP 点击确认兄弟 wiki 链接与 wikilink 范围只加载 10-29 行、跨集合文件链接与 `/documentation/5:30-41` 打开共享区间预览、`/decisions/2` 与 `/decision/2` 跳同一规范 URL。编辑态报告 `wikilink-aware mdlink-aware` 包装与两种 token。

## Related Concepts

- [[concepts/relative-reference-resolution]] — wikiRoot 分流与项目相对基准
- [[concepts/wikilink]] — wikilink 范围、编辑器渲染与高亮
- [[concepts/web-ui-features]] — 共享 Markdown 点击契约
- [[concepts/markdown-pipeline]] — 扩展名锚定的范围切分与尖括号保护

## Related Sources

- [[sources/back-835-unify-relative-reference-resolution]] — 两阶段 join
- [[sources/back-836-decision-relative-reference-resolution]] — 共享点击契约
- [[sources/doc-34-relative-link-check]] — doc 侧 fixture
- [[sources/decision-2-relative-link-check]] — decision 侧 fixture
- [[sources/m-19-fix-relative-reference-resolution]] — 所属里程碑
