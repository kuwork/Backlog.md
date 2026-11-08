---
title: BACK-836 - 修复 decision 页相对引用解析
labels: [source, web-ui, markdown, decisions]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/tasks/back-836 - Fix-decision-relative-reference-resolution.md
---

# BACK-836 - 修复 decision 页相对引用解析

BACK-835 的 join 会把 `../` 折算进渲染基准的目录深度。decision 页传的是 `decision.path`（相对 `<data-dir>/decisions` 的**裸文件名**），任何爬出 decisions 目录的引用都被判为项目根逃逸、塌成死 `#` 锚点，无法链接 docs/ 与 wiki/。本任务把文档页已有的边界转换复用到 decision。

## 做法

- `/api/decisions` 与 `/api/decisions/:id` 都派生 `projectPath` = `relative(rootDir, decisionsDir)` + 集合内相对文件名，复用 BACK-835 的 `collectionProjectPath`，因此自定义数据目录名无需硬编码前缀。列表端点原先**完全不返回 `path`**，一并补上以免 `DecisionDetail` 的 fallback 没有基准。
- `Decision.projectPath` 是 API 派生字段、**从不持久化**；`DecisionDetail` 传 `projectPath ?? path` 给 `MarkdownEditor`。存储的 path、显示、保存、加载、`/` 前缀路由层与有序候选表保持不变。
- 回归测试证明：裸文件名基准会把 `../wiki/concepts/auto-port.md` 塌成 `#`，项目相对基准则 join 成 `/backlog/wiki/concepts/auto-port.md`。

## 验收后的两项 follow-up

**点击契约对齐。** `DocumentationDetail` 原本独有一套完整 Markdown 点击契约（文件 / Office 预览 + 五个实体回调带行范围），`DecisionDetail` 只有内联导航回调，导致本地文件链接退化成普通 anchor、带范围的实体链接丢失行号。契约统一抽到 `MarkdownLinkPreview.tsx`（`useMarkdownLinkPreview` + `MarkdownPreviewModal`），两个页面共用同一个 `linkHandlers` 属性；`DocumentationDetail` 里五处重复回调与嵌套 Office/PDF 预览块被删除。验证时还发现**陈旧标题 slug bug**：换文档的链接在新文档加载前就改了路由，把旧标题写进 URL；slug effect 现在等 `document.id` 与路由 id 一致。

**空标签高亮。** 编辑器 prism 对 `[]` / `![]` 不发 link token，而 `mdlink` overlay 只覆盖含空格与尖括号目标；补一条 empty-label 分支，让 `[](doc.md)`、`![](img.png)`、`[](doc with space.md)` 也显示蓝色，普通非空标签仍走内建语法。

## 边界

wiki 与 memo 表面明确不在范围内（由 BACK-837 单独处理）。

## 验证

48 → 133 个作用域测试通过（`--timeout 30000`）；`tsc --noEmit`、Biome 干净。全新 Web 构建下 doc-34 与 decision-2 的六条链接生成完全相同的锚点，CDP 点击显示四个本地文件链接与带范围实体链接打开同一预览、普通实体链接跳同一规范 URL。临时 `decision-999` fixture 验证后已删除。

## Related Concepts

- [[concepts/relative-reference-resolution]] — 集合内相对路径 → 项目相对基准
- [[concepts/web-ui-features]] — 跨页面共享的 Markdown 点击契约
- [[concepts/markdown-pipeline]] — mdlink overlay 空标签分支

## Related Sources

- [[sources/back-835-unify-relative-reference-resolution]] — 提供 collectionProjectPath 与两阶段解析
- [[sources/back-837-wiki-relative-references-entity-links]] — 同一契约推广到 wiki
- [[sources/decision-2-relative-link-check]] — decision 侧验收 fixture
