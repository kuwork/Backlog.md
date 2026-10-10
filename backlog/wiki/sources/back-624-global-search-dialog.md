---
title: BACK-624 - Web 全局 Spotlight 式搜索对话框
labels: [source, web-ui, search, routing, modal]
created_date: 2026-09-13 01:12
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-624 - Global-Spotlight-style-search-dialog-for-Web-UI.md
---

# BACK-624 - Web 全局 Spotlight 式搜索对话框

Web UI 的搜索被困在侧边栏里：下拉最多显示 5 条结果，输入框嵌在导航树内部（BACK-483）。本任务把它换成 macOS Spotlight 式居中对话框——一个 `/search` 模态框叠在路由之上，分组、虚拟化、全键盘驱动的结果列表，且保持底层页面挂载、浏览器返回时恢复滚动位置、并能从共享 URL 原样重开。

- **路由壳**：`/search` 在 `App.tsx` 注册为模态路由（`location.pathname === "/search"` 渲染 `SearchDialog`，主内容仍从 `state.backgroundLocation` 渲染）；`/search` 与 `/search/*` 加入服务器 SPA 静态路由表，刷新/分享链接不会 404——唯一动到服务器的地方，未改 API 逻辑
- **历史语义走 React Router**（PRD 适配：代码库里不存在原生 `pushState`/`popstate`）：打开 = `navigate('/search?...')` 压栈，输入/过滤切换 = `navigate(..., { replace: true })`，四条关闭路径（Esc / × / 点遮罩 / 浏览器返回）都是 `navigate(-1)`；`location.state` 携带 `{ q, type, visibleStartIndex }`
- **数据**：复用 `GET /api/search`——它本就返回无限制结果、`task|document|decision|wiki` 类型过滤、wiki 内容搜索与用于高亮的 `SearchMatch` 索引；5 条上限只是客户端行为
- **组件**：`SearchDialog.tsx`（居中 800px、12vh 起、最大 75vh、焦点陷阱、body 滚动锁定、300ms 防抖、加载/空态）、`search/VirtualList.tsx`（手写的定高窗口化，带 `scrollRowIntoView` 与 overscan——无新依赖）、`utils/search-results.ts`（纯函数辅助：行构建/分组、高亮区间合并、恢复索引钳制、链接 + 元信息解析），31 个单元测试覆盖
- **呈现**：单栏分组列表，可折叠类型头（Enter/Space 或点击），标题*和*资源 ID 关键词高亮（来自服务器匹配区间），状态/优先级小丸与 TaskList/DraftsList 通过新的 `utils/task-badge-colors.ts` 共享，四语 i18n
- **键盘与视口**：方向键移动选中，Enter 打开；640px 以下对话框全屏、定高两行，虚拟滚动与 `visibleStartIndex` 恢复行为一致
- **导航身份**：搜索目标打开为 `/task/:id/:slug`（任务；`/?highlight=id` 路由破坏了返回对话框），doc/decision/wiki 则是普通 push——它们是完整页面而非模态框——`isModalSearchTarget()` 门控 `backgroundLocation`
- **反馈轮次**：遮罩重样式对齐任务模态框（无模糊），首条结果加载期间用不可见占位保持窗口高度，输入字号放大（28px/32px，窄屏 ≥16px 避免 iOS 聚焦缩放），本地输入草稿 + 防抖 URL replace 消除光标抖动，侧边栏搜索框改为只读触发按钮
- **已知遗留**：完整的 `zh-TW` 语言审计（仅统一了 `searchDialog` 术语：工作 → 任務）

## 验收标准

- Ctrl+K / Cmd+K 从任意位置打开对话框；底层页面保持挂载且滚动锁定
- Esc、×、点遮罩、浏览器返回都关闭对话框并恢复之前的路由
- 刷新或分享 `/search?q=...&type=...` 会用查询、过滤与结果重开对话框
- 浏览器返回会重渲染对话框并通过 `visibleStartIndex` 恢复列表滚动
- 虚拟滚动在大结果集下保持顺滑；窄视口得到全屏两行行

## Related Concepts

- [[concepts/spotlight-search]] — 对话框的路由、虚拟化、分组与滚动恢复模型
- [[concepts/web-ui-features]] — 对话框现属的 Web UI 功能目录
- [[concepts/search-sequences]] — 对话框消费的服务器端 Fuse 搜索与类型过滤模型
- [[concepts/web-server]] — `/api/search` 契约与 SPA 静态路由表
- [[concepts/web-ui-i18n]] — 对话框字符串加入的四语字典

## Related Sources

- [[sources/sidebar-resize-search-task]] — 被本对话框取代的 BACK-483 侧边栏搜索（5 条上限）
- [[sources/stable-task-modal-urls-task]] — 此处复用的 BACK-509 模态叠路由 URL 模式
- [[sources/back-627-back-arrow-history-fix]] — 对话框暴露的 BACK-627 历史栈不变量
- [[sources/back-628-task-hierarchy-section]] — 同一波中随后的 BACK-628 模态框分区
