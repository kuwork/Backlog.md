---
title: 跨页面 Markdown 链接契约对齐与验收步骤
labels: [execution, markdown, web-ui, testing, cdp]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
extracted_from:
  - BACK-835
  - BACK-836
  - BACK-837
  - BACK-838
---

# 跨页面 Markdown 链接契约对齐与验收步骤

适用于新增或改动任何一个能渲染 Markdown 的页面（doc / decision / wiki / task / milestone / memo / 嵌套文件预览）时。BACK-836/837 的教训是：**契约一旦在两个页面各写一份，行为必然漂移**。

## 标准步骤

1. **先找基准**：确认该页面传给 `MarkdownEditor` 的 `filePath` 是**项目相对**的 `projectPath`，而不是集合内相对的 `path` 或裸文件名。用一条 `../` 跨集合链接验证：若渲染成 `#`，就是缺 API 边界的 `collectionProjectPath` 转换。
2. **复用单一契约**：接 `useMarkdownLinkPreview` / `MarkdownPreviewModal` 的 `linkHandlers`，不要复制回调。页面只在必要时覆盖（如 wiki 的 `onWikiClick`）。删除页面本地的 document 级 click handler —— 它们先于 React 委派 handler 运行，会造成双重导航、丢行范围。
3. **检查 capture-phase 拦截器**：`Layout.tsx` 的 document 级 Office 拦截器先于所有 Markdown handler 并 `stopPropagation`。任何新的链接形态都要在这里也接共享解析器，否则「契约层改对了但点击仍然 404」。
4. **补编辑态**：含空格 / 尖括号 / 空标签目标靠 `mdlink` overlay，`[[...]]` 靠 `wikilink` overlay；确认包装器标记与 token 存在，普通链接仍走内建语法。
5. **造三向 fixture**：同一批链接至少在 doc、decision、wiki 三种集合各放一份（见 doc-34 / decision-2 / wiki test 页），覆盖跨集合、含空格文件名、全角冒号、`:N-M` 区间、空标签、实体短链、外链。三种基准深度不同，只测一种会漏。
6. **验证**：全新 Web 构建（改了 bundle 要重启 browser 让 Bun 重编），在查看态检查 DOM href、在编辑态检查 token，再用 CDP 点击逐条确认预览或导航；断言两页锚点完全一致。临时 fixture 验完删除。

## 常见陷阱

| 症状 | 根因 |
|---|---|
| 链接变死 `#` 锚点 | 渲染基准是集合内相对路径 / 裸文件名，或范围 token 被当成 URI scheme |
| 范围预览 404 | 范围 token 被拼进 `/api/raw-file?path=`（capture-phase 拦截器没走 `parseOfficeLink`） |
| 标题与徽标重复 | 模态框标题用了含范围的 basename，没用干净文件名 |
| 带空格的 wiki 兄弟页打不开 | `%20` 被二次编成 `%2520`；用 `encodePath` 每段先解码一次再编码 |
| `](<...>)` 目标被转义 | `sanitizeRawHtmlAngleBrackets` 把 `</backlog/...>` 当闭合标签 |
| 换文档后 URL 带旧标题 | slug effect 没等 `document.id` 与路由 id 一致就改路由 |
| 全角冒号文件名被误切范围 | `splitTarget` 没锚定在文件扩展名之后 |
| 内联预览滚动带动外层页面 | `<figure>` 内 viewer 未隔离滚动 |

## 回归清单（每次改动后）

- 外链、`/` 前缀实体路由、`#` 锚点、query-only 目标行为不变
- 既有的 `assets/...`、`/assets/paste/...`、`/documentation/10:55-74` 无需迁移仍可用
- 普通图片仍走 lightbox，普通 Markdown 文件链接仍是文本预览
- 越界页范围 clamp 不报错、不存在的工作表停默认表不报错
- 裸数字 `:3-7` 仍按文本行处理（不是页范围）
- 项目根逃逸与敏感路径仍被拒绝

## Related Concepts

- [[concepts/relative-reference-resolution]] — 契约本身
- [[concepts/markdown-pipeline]] — join 与 overlay token
- [[concepts/web-ui-features]] — 共享点击契约
- [[concepts/wikilink]] — wikilink 与显式路由分流

## Related Sources

- [[sources/back-835-unify-relative-reference-resolution]]
- [[sources/back-836-decision-relative-reference-resolution]]
- [[sources/back-837-wiki-relative-references-entity-links]]
- [[sources/back-838-office-page-sheet-ranges]]
- [[sources/doc-34-relative-link-check]] / [[sources/decision-2-relative-link-check]] / [[sources/doc-35-office-link-check]]
