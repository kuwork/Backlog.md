---
title: 全局搜索对话框（Spotlight Search）
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
labels: [concept, web-ui, search, routing]
---

# 全局搜索对话框（Spotlight Search）

Web UI 的全局搜索从侧边栏内联下拉重构为 macOS Spotlight 风格的居中对话框（BACK-624）。它是 fork 中第一个以 **modal-over-route** 形式落地的纯前端搜索表面：URL 即状态、历史栈即关闭语义、虚拟列表即性能边界。

## 路由与历史语义

| 行为 | 实现 |
|---|---|
| 打开（Ctrl/Cmd+K、侧边栏触发按钮） | `navigate('/search?...', { state: { backgroundLocation } })`（push） |
| 输入关键词 / 切换 type 过滤 | `navigate(..., { replace: true })`（不增长历史栈），300ms 防抖 |
| 关闭（Esc / × / 遮罩 / 浏览器后退） | 统一 `navigate(-1)` |

- 绑定到 `/search?q=<关键词>&type=all|task|doc|wiki|decision`；`q` 为空表示无输入
- `location.state`（由 `history.state` 承载）携带 `{ q, type, visibleStartIndex }`
- 刷新或分享链接可直接还原查询、过滤与结果（依赖 SPA 静态路由表中的 `/search`、`/search/*`）
- 底层页面保持挂载并锁定滚动，不新建全屏搜索页

**为什么用 React Router 而非原 PRD 的 `pushState`/`popstate`**：fork 中不存在裸 history API 调用，Router 已接管 popstate；用 Router 语义等价且可测试（见 [[decisions/react-router-history-for-search-dialog]]）。

## 结果呈现

- 单列分组列表：分组顺序 `task → document → wiki → decision`，每组一个可折叠表头（点击或 Enter/Space 折叠；折叠后其行不进入虚拟列表）
- 行结构：类型图标 + 资源 ID + 标题（关键词高亮）+ 弱化状态/优先级胶囊；**ID 也参与高亮**（`getIdMatchIndices`，含 wiki 路径偏移）
- 高亮区间来自服务端 `SearchMatch.indices`（Fuse 的 `[start, end]` 闭区间），客户端 `mergeHighlightRanges` 合并重叠/相邻区间
- 无右侧预览面板、无结果数量上限（旧侧边栏下拉硬编码 5 条）

## 虚拟列表

`src/web/components/search/VirtualList.tsx` 手写定高窗口化（无新依赖）：

- 行高常量按视口模式取值：桌面 item 56 / header 28，窄屏 item 64 / header 32
- 前缀和 `offsets[]` + 二分查找起始行，`overscan = 4`，暴露 `scrollRowIntoView(rowIndex)`
- `resetKey`（查询/过滤变化）变化时重置到顶部
- 滚动位置记忆用 **`visibleStartIndex`（首个可见行索引）而非像素 `scrollTop`**：定高行下索引比像素更稳定，`clampRestoreIndex` 对越界索引返回 null 由调用方回退到顶部
- 滚动时以 300ms 防抖 `replace` 写回 `location.state.visibleStartIndex`

## 导航目标

`isModalSearchTarget()` 只对 `task` 返回 true：

- 任务/草稿 → `/task/:id/:slug`（overlay 模态路由），并携带 `backgroundLocation = /search`，关闭后回到对话框
- 文档/决策/wiki → 普通 push 到整页路由（它们不是模态），back 可回到 `/search`

早期用 `/?highlight=id` 打开任务会经 BoardPage 再 push 任务，导致浏览器后退落到 `/` 而不是重新打开 `/search`，已改为直接 `/task/:id/:slug`。

## 视口适配

- 桌面：水平居中、距顶 12vh、固定 800px 宽、`max-height: 75vh`、深色遮罩
- 窄屏（`< 640px`）：全屏（100vw × 100dvh、无圆角/遮罩），行改为定高两行布局（第一行标题高亮，第二行 ID + 状态/优先级胶囊），保证行高恒定，虚拟滚动与 `visibleStartIndex` 还原逻辑无需分支
- 输入字号 28px（窄屏 32px，且 ≥16px 以避免 iOS 聚焦缩放）

## 已知遗留

- `zh-TW` 全量文案审计未完成（本波仅统一 `searchDialog` 术语：工作 → 任務）

## Related Concepts

- [[concepts/web-ui-features]] — 对话框在 Web UI 功能地图中的位置
- [[concepts/search-sequences]] — 服务端 Fuse 搜索与 type 过滤模型
- [[concepts/web-server]] — `/api/search` 契约与 SPA 静态路由表
- [[concepts/web-ui-i18n]] — `searchDialog` 命名空间与四语言字典
- [[concepts/task-identity]] — 资源 ID 前缀无关匹配

## Related Sources

- [[sources/back-624-global-search-dialog]] — 实现来源
- [[sources/sidebar-resize-search-task]] — 被替换的侧边栏搜索
- [[sources/back-627-back-arrow-history-fix]] — 同一历史栈不变式下的修复
