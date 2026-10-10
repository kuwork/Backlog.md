---
title: BACK-669 - Web 首屏加载状态打磨
labels: [source, web-ui, loading]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-669 - Polish-the-web-UI-initial-loading-state.md
---

# BACK-669 - Web 首屏加载状态打磨

把上游加载状态打磨（PR #977，"the old ugly square"）移植到 fork 的两个首次加载前表面。fork 的根因：`rounded-full` 被刻意排除在编译后的 Tailwind CSS 之外，因此看板首屏 spinner 渲染成一个旋转的带边框方块，应用初始化前屏幕只有光秃秃的 "Loading..." 文本。

- 根因在 fork 内验证：`src/web/styles/source.css` 排除 `rounded-full`（`@source not inline(...)`；项目工具类是 `rounded-circle`）；报告的"约 13k px 巨型 SVG"无法复现——它对应样式表应用前未加样式的 dev shell
- 新 `BoardLoadingSkeleton.tsx`：`columnCount` 个幽灵列镜像真实列外观（`flex-1 min-w-[16rem]`、`rounded-lg p-4 min-h-24` 卡片——`min-h-24` 是 TaskColumn 的空态下限，看板不会收缩），`animate-pulse` 占位遵循 `motion-reduce`，全部 `aria-hidden`，紧凑圆环居中于其上，sr-only `t.board.loading`
- fork 差异：骨架屏不接 `message` prop、不渲染进度句子——该信号自 BACK-668 起由头部 chip 独占，第二份会重复同一行；标签来自 i18n 而非硬编码英文
- `App.tsx` 初始化前屏幕（`isInitialized === null`）在 `role="status"` 下渲染共享 `LoadingSpinner` 圆环 + sr-only `t.nav.projectLoading`；`LoadingSpinner` 增加了 `motion-reduce:animate-none`（后来又被 BACK-670 移除）
- 死管道清除：Board/BoardPage 丢掉 `loadingMessage` prop 和被 BACK-668 孤立的 `translateLoadingMessage`/`locale` 残留；BACK-668 的 `hasLoadedDataRef` 门控不动，只有首次加载前窗口显示骨架屏
- 真机经 CDP 测量（端点经 Fetch domain 保持）：圆环计算为 9999px 半径，幽灵列与真实列几何一致，内容干净替换幽灵；7 个回退探针全红，6 个新 jsdom 用例，20/20 范围内测试

## 验收标准

- 初始化前屏幕在两种主题下显示共享 spinner 圆环 + 本地化 sr-only 标签，不再是裸文本
- 看板首次加载分支渲染 `BoardLoadingSkeleton`，`statuses.length` 列（三幽灵兜底）镜像真实列外观
- 加载路径永不使用死掉的 `rounded-full`；骨架屏只经 `role="status"` + 本地化标签播报，无重复进度句
- Board/BoardPage 不残留 `loadingMessage` prop；jsdom 测试覆盖骨架屏、BoardPage 加载与初始化前屏幕并带回退探针

## Related Concepts
- [[concepts/browser-loading]] — 首次加载前加载面与骨架屏设计
- [[concepts/web-ui-features]] — 骨架屏镜像的看板列外观

## Related Sources
- [[sources/back-668-branch-indexing-header-chip]] — 前置：独占会话中加载信号与 `hasLoadedDataRef` 门控（批次兄弟）
- [[sources/back-670-loading-motion-reduce-removal]] — 移除本任务所加 motion-reduce 逃逸的后续（批次兄弟）
- [[sources/back-613-web-task-list-width-page-shell]] — 早期看板布局几何工作
