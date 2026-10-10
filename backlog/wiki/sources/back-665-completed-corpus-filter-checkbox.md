---
title: BACK-665 - 看板与任务列表加 completed 复选框
labels: [source, web-ui, filtering, completed-corpus]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-665 - Add-a-completed-corpus-checkbox-to-the-web-board-and-task-list-filter-bars.md
---

# BACK-665 - 看板与任务列表加 completed 复选框

Web UI 已能读取 completed 语料（BACK-662 扩大了搜索选项，BACK-663 只读渲染那些弹窗），但看板和任务列表都无法浮出它。本任务把可选的 "Show completed" 复选框加为两个过滤器栏最右的控件，清空过滤器按钮直接统一在其后。

- 共享件一次构建、两个视图复用：`CompletedFilterToggle.tsx`（复选框 + 标签）与 `useCompletedTasks(enabled)`（仅在启用时经 BACK-662 的 `completed=true` 搜索选项拉取语料，未勾选零开销）
- 复选框状态与其他过滤参数一样挂在 URL（`completed=1`），刷新和分享链接后仍在；它计为活跃过滤器，清空过滤器也会取消勾选
- 已完成记录走普通管道——相同过滤、排序、状态列分组与计数——而不是平行管道；任务列表在过滤后的重查询上带 `completed: showCompleted`，扩大的语料不会被第二个请求丢掉
- 线标是 `task.source === "completed"` 而不是 `isCompleted`（序列化前已丢弃）；hook 只保留带 `source: "completed"` 标签的记录，因为扩大搜索也会用活跃语料应答——直接追加会让每个活跃任务重复（测试经重复 React key 抓到）
- 仅复选框留下的两个缺口：completed `TaskCard` 现在像跨分支卡片一样 `draggable={false}`（状态拖拽无法写入 `backlog/completed/`）；`App.handleOpenTask` 在导航状态带 `preloadedTask`，点击已完成行打开只读弹窗而不是弹回看板
- 评审跟进：completed 标记移到卡片头部右侧徽标组、优先级徽标左边，经共享 `CompletedBadge` 穿模态框 mark-completed 按钮的 emerald，看板与列表的颜色和 tooltip 不会漂移
- i18n：`common.showCompleted` 加入 en/zh-CN/zh-TW/ja；经 CDP 在 zh-CN 实测验证，外加每个行为的逐半回退探针

## 验收标准

- 两个视图都渲染 completed 复选框作为最右过滤控件，默认未勾选且关闭时输出逐字节一致
- 复选框状态经 URL 持久化；开启后已完成记录出现、遵循所有其他过滤、落在自己独立的看板列并被计数
- 点击已完成行/卡片打开 BACK-663 只读弹窗，无编辑或评论入口
- 清空过滤器紧邻复选框之后，即使它是唯一活跃过滤器也重置它
- 控件、拉取与徽标只存在一份并被两视图复用；测试覆盖默认关闭一致性、勾选后出现、清空取消勾选

## Related Concepts
- [[concepts/web-ui-features]] — 本控件加入的看板与任务列表过滤器栏约定
- [[concepts/task-lifecycle]] — completed 语料作为区别于 Done 状态的目的地
- [[concepts/web-ui-i18n]] — 每个过滤控件的四语言标签要求
- [[concepts/statistics-corpus-scope]] — CompletedFilterToggle 作为统计共享语料 scope 开关面

## Related Sources
- [[sources/back-628-task-hierarchy-section]] — 同一模态框；`handleOpenTask` 复用其 `onDrillDown`/`preloadedTask` 模式
- [[sources/back-624-global-search-dialog]] — completed 选项所搭乘的搜索基础设施
- [[sources/back-672-wiki-tree-sort-toggles]] — 同波侧边栏/过滤打磨（批次兄弟）
