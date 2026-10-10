---
title: BACK-731 - Memos 信息流页与快捷捕获
labels: [source, web-ui, feature]
created_date: 2026-10-03 01:07
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-731 - Memos-feed-page-with-quick-capture.md
---

# BACK-731 - Memos 信息流页与快捷捕获

这是让整个里程碑可见的任务：/memos 页面——一条笔记一键输入保存，保存后以倒序卡片流读回。没有它，BACK-729 的 API 就没有用户价值。交付物：新建 src/web/components/MemosPage.tsx、接入 App.tsx Layout 路由组、SideNavigation 增加 Memos 入口（展开列表 + 折叠图标栏）、api.ts 增加客户端方法、四个语言文件补 locale 键。卡片复用 MermaidMarkdown 渲染器和 StoredDate，编辑器复用 PasteAwareMDEditor。

## 实现要点

架构要点：页面组件自第一天起就持有共享视图状态（feed | calendar）和 selectedDate，为 BACK-732 的日历任务留好扩展缝而不是重写；分页基于游标 + IntersectionObserver 哨兵自动加载（捕获收件箱注定持续增长）；src/web/utils/memos.ts 抽出纯函数 feed 状态 helper（appendMemoPage / prependMemo / replaceMemo / collectMemoTags / extractInlineTags 等），使分页追加可独立单测；分页用请求 epoch 追踪与跨游标去重，保证追加不丢已加载行、不扰动滚动位置。失败写入保留笔记并显示本地化错误横幅，而非静默丢弃。

收尾修复：子代理被速率限制打断后遗留的 4 个 TS 错误（errorMessage 未定义、ErrorBanner 传参错误、测试 helper 联合类型、错误横幅本地化）；浏览器 smoke 污染 repo 的 31 个真实 memo 文件已清理；粘贴图片在保存前经 apiClient.promoteAssets 提升并 replaceTempImageUrls 重写临时 URL（对齐 TaskDetailsModal 评论保存模式），编辑器保留重写后的草稿以便失败重试。

## 验证

结果：/memos 上线——顶部 quick-capture composer（按钮 + Cmd/Ctrl+Enter 保存，新 memo 立即置顶）、卡片流（StoredDate + MermaidMarkdown，[[wiki]] 链接与实体链接免费生效）、只读 tag chips + 标签过滤条、内联编辑/删除、?view= 深链、四语言 locale 完备。web-memos-page.test.tsx 6 个测试 + memos.test.ts 13 个测试通过，tsc 与 biome 干净。

## Related Concepts

- [[concepts/web-ui-features]] — Web UI 路由、导航与页面结构
- [[concepts/web-ui-i18n]] — 四语言 locale 文件同步惯例（en.ts 为类型源）
- [[concepts/markdown-pipeline]] — MermaidMarkdown 渲染器承接的正文渲染管线
- [[concepts/asset-management]] — 粘贴图片的临时资源提升（promoteAssets）机制
- [[concepts/memos]] — /memos 信息流页面与游标分页所属的 memos 子系统

## Related Sources

- [[sources/back-729-memo-http-api]] — 页面消费的 HTTP API（依赖 BACK-729）
- [[sources/back-732-memos-calendar-mode]] — 在同一组件上扩展日历模式的后续任务（依赖 BACK-731）
