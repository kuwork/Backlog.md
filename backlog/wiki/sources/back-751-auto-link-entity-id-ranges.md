---
title: BACK-751 - 实体 ID 区间与斜杠列表自动链接
labels: [source, web-ui, enhancement, markdown]
created_date: 2026-10-07 22:50
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-751 - Auto-link-entity-ID-ranges-and-slash-lists-as-a-clickable-dropdown-selector.md
---

# BACK-751 - 实体 ID 区间与斜杠列表自动链接

扩展 BACK-614 的渲染侧自动链接器，识别两种共享同一实体种类/前缀的多 ID 模式：区间 `BACK-715~747`（含端点）与斜杠列表 `BACK-743/744/745`（任意数量）。匹配 token 渲染为单个可点击触发器，点击打开下拉，逐条列出已解析实体为可导航链接。条目数不限——下拉需对几十条条目（如 33 项区间）保持可用。种类复用 BACK-511/BACK-614 短别名系统（task/document/decision/draft）；Wiki `[[wikilink]]` 不在范围内。失败闭合如 BACK-614：未知或混合种类保持纯文本；空索引不链接。

## 实现要点

- **渲染侧**：`splitEntityIds` 新增多 ID 分支，发出单一 `link` 节点，href `entity-range:<kind>:<token>`，列表在渲染时重新解析，链接节点保持小巧不随过期索引变陈旧
- **下拉**：`EntityIdRangeDropdown` 用 `createPortal` 到 `document.body`，`position: fixed`、`z-[9999]`，避免被 markdown 容器/宿主 modal 裁剪；测量后定位、`maxWidth` 取两向较大者并钳制到视口、右缘溢出时翻转到触发器左侧；`minWidth` 固定 200（非触发器宽度）；行 ID `whitespace-nowrap`；暗色通过 `MutationObserver` 读 `documentElement` 的 dark 类（非 React 主题 context）；关闭策略：外部 mousedown + resize；条目点击有 in-app handler 时 `preventDefault` 走 SPA，否则原生同标签导航
- **折叠进本任务的后续**：memos 默认视图（有内容→board、空→list、显式 view/日期过滤不被覆盖）；memos 侧栏图标替换为 1024 网格双路径字形；钉板墨迹溢出修复（`wrapEstimate` 用烘焙器真实 `measure` 含 bold 标志，`clampLine` 硬截断兜底）

## 验证

四类套件 253 pass / 0 fail；`bunx biome check` 干净、`tsc --noEmit` 在 `src/` 下零错误

> 注：BACK-751 的范围已合并进 BACK-750（其 ticket 文件移入 `backlog/archive/tasks/`），话题语法与 composer 自动补全随 BACK-750 交付；本页保留其下拉链接器的独立记录。

## Related Concepts
- [[concepts/wikilink]] — 自动链接与反向链接的渲染语义
- [[concepts/markdown-pipeline]] — 渲染侧 remark 插件与 token 解析
- [[concepts/memos]] — 折叠进的 memos 默认视图/侧栏图标

## Related Sources
- [[sources/back-614-entity-id-auto-link-autocomplete]] — 前置任务：单 ID 自动链接（区间/列表在其之上扩展）
- [[sources/back-753-referenced-by-backlinks]] — 复用同一多 ID token 解析器（反向链接扫描）
- [[sources/back-750-memo-tag-bar]] — 合并目标（话题语法随其交付）
