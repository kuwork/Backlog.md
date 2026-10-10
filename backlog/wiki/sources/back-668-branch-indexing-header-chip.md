---
title: BACK-668 - 跨分支索引加载指示器打磨
labels: [source, web-ui, loading, cross-branch]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-668 - Polish-the-cross-branch-indexing-loading-indicator-in-the-web-UI.md
---

# BACK-668 - 跨分支索引加载指示器打磨

服务端的跨分支索引阶段行被原样渲染在四个地方（看板加载面板加侧边栏三处），且每个 `loading` 帧都把 `isLoading` 翻回开——用骨架屏替换已加载内容，看起来像闪烁。本任务把信号合并为一个带头部细线扫动的 chip，并阻止会话中帧卸载已加载内容。

- 新 `BranchIndexingIndicator.tsx`：头部右侧簇中一个 `role="status"` chip，外加钉在头部底边框上的 2px 扫动轨道，由延迟出现（250ms）/淡出（200ms）状态机驱动，两个延迟都作 prop 以便测试；在出现窗口内完成的阶段不挂载任何东西
- chip 可见标签是真实进度行经 `translateLoadingMessage` 翻译的结果——fork 相对移植版硬编码 "Indexing branches" 标题的有意差异——`max-w-[16rem]` 截断，完整行作 tooltip；无新语言 key，未匹配阶段回退到服务端原始行
- 连续进度消息保持指示器挂载并替换标签，而不是重启出现窗口；`lastMessageRef` 让行保留到退出淡出的结束
- `App.tsx` 让会话中骨架屏以 `hasLoadedDataRef` 为门：首次成功加载前 `loading` 帧才设置 `isLoading`，因此索引运行时已加载的看板与树保持挂载且可交互
- `SideNavigation` 去掉 `loadingMessage` prop（三个占位变成纯骨架屏）；`App` 不再把消息传给 `Board`，头部 chip 成为阶段行唯一出现处
- CSS 块（`indexing-sweep` keyframes）逐字节移植，未来合并无冲突；该组件是唯一承载差异的文件
- 冷启动窗口内经 CDP 在两种主题下实测验证（通过移除 `.dark` 捕获亮色，帧以 virtual-time 暂停冻结）；6 用例指示器套件加更新的深链与侧边栏套件，所有探针先确认红

## 验收标准

- 索引状态显示为头部 chip 加细线扫动；四个原始句子位置不再渲染阶段行
- chip 标签是经 `loadingPhrases` 翻译的真实进度行，原始回退，截断有 tooltip，无新语言 key
- 首次成功加载后，后续索引帧让看板与侧边栏树保持挂载且可交互
- 指示器仅在阶段持续后出现，淡出后才卸载；连续消息只换标签不重启
- 每个新用例先对照回退改动确认为红；两种主题下实测验证

## Related Concepts
- [[concepts/browser-loading]] — 本任务重组的加载状态面与骨架屏门控
- [[concepts/web-ui-features]] — 头部布局与加载约定
- [[concepts/web-ui-i18n]] — chip 复用的 `loadingPhrases` 翻译表

## Related Sources
- [[sources/back-669-initial-loading-skeleton]] — 覆盖首次加载前表面的直接后续（批次兄弟）
- [[sources/back-670-loading-motion-reduce-removal]] — 从本 chip 移除 motion-reduce 逃逸的后续（批次兄弟）
- [[sources/back-602-incremental-cross-branch-task-loading]] — 显示其进度的跨分支加载功能
