---
title: BACK-613 - web 任务列表免横向滚动并收敛页面内边距
labels: [source, web-ui]
created_date: 2026-09-06 21:26
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-613 - Make-the-web-task-list-fit-without-horizontal-scroll-and-trim-page-padding.md
---

# BACK-613 - web 任务列表免横向滚动并收敛页面内边距

web 任务列表表格总是比内容区宽：colgroup 固定了全部八列宽度（合计 91rem，table-layout:fixed 下无论视口如何都是 1456px），且每个页面根用 Tailwind 视口断点的 `container mx-auto px-4 py-8`，侧栏收起时留下宽沟槽。三处实测布局修复——单一列宽来源、共享全宽 `.page-shell`、不再预留不可见空间的过滤行——在笔记本与桌面视口消除文档级横向溢出。

- `src/web/components/TaskList.tsx`：单一宽度来源 `TASK_COLUMN_WIDTHS_REM`（8 列，仅 Title 可伸缩）；派生表格最小宽度 59.5rem 取代硬编码 `min-w-[1100px]`；`renderColumnGroup` 读取该常量。
- 'Clear filters' 仅在有过滤激活时渲染，取代 `visibility:hidden` 占位（回收约 112px）；优先级 select 最小宽度 140→120px 放宽。
- `src/web/styles/source.css`：共享 `.page-shell`（width 100%、padding 1.5rem 1rem）在 7 个页面根替换 Tailwind container（TaskList、BoardPage、DraftsList、MilestonesPage、Settings x3）。
- 主题化滚动条加入 base 层：`scrollbar-color` 透明轨道 + 细主题匹配滑块（亮 0.22 / 暗 0.2）、所有元素 `scrollbar-width: thin`、webkit 回退；`.scrollbar-hide` 仍计算 `scrollbar-width: none`。
- `src/web/components/Modal.tsx:48`：共享模态框表面加 `border-gray-200 dark:border-gray-600`，在暗色背景下可辨识。
- 验证：全 Chromium 矩阵（1440x900、1512x982 x 侧栏 320/收起/500px；1920x1080、1920x1200、3840x2160 100%/150% 缩放）——所有状态文档溢出为 0；前后截图存 `backlog/assets/images/back-613/`；jsdom 不变量测试 `src/test/web-task-list-table-width.test.tsx`。

## 验收标准

- 1440x900 与 1512x982 侧栏收起/展开均无横向滚动条；500px 侧栏时表格在自身容器内滚动且无文档级溢出。
- 页面根使用共享全宽 page shell；沟槽明显收窄。
- 未移除或隐藏任何列；Title 是唯一可伸缩列。
- 所有滚动条在两种配色主题下用低调主题样式；模态框经边框/阴影可辨识。
- 过滤控件在确实放得下时保持单行；Clear filters 仅在过滤激活时渲染。
- 回归测试钉住无需浏览器即可检查的布局不变量。

## Related Concepts

- [[concepts/web-ui-features]] — 任务列表布局、侧栏状态与过滤行行为。
- [[concepts/web-server]] — 布局不变量被钉住的 web 界面。
