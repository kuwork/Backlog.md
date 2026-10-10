---
title: BACK-420 - Web UI 任务内容目录与 scrollspy
labels: [source, web-ui, enhancement]
created_date: 2026-10-03 01:07
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-420 - Add-task-content-TOC-and-scrollspy-in-Web-UI.md
---

# BACK-420 - Web UI 任务内容目录与 scrollspy

跟踪 GitHub issue #405 的一部分：为 Web UI 中冗长的任务内容提供目录（TOC）与当前章节高亮（scrollspy）。本任务的大部分 UI 已在 BACK-726（任务详情模态框的 markdown 大纲抽屉）中落地，因此这里的工作是验证与补齐缺口，而非新功能。

## 实现要点

方案上复用 BACK-726 的共享件：Modal 的 `toc` prop 渲染 TocDrawer，`useTocItems` 收集标题、`useTocTree` + `TocRows` 做层级与折叠、`useActiveTocId` 做 scrollspy 高亮，点击平滑滚动；MermaidMarkdown 渲染器本身用 github-slugger 为标题生成稳定的页内锚点（CJK 安全、重复标题自动加后缀）。

验证过程中修掉一个真实 bug：`findScrollContainer` 原先从内容元素的父节点开始找滚动容器，而模态框里可滚动的就是内容容器本身，导致模态框 scrollspy 监听的是 window 滚动、永远不高亮。修复后从元素自身开始查找（全页场景不受影响）。

按评审反馈把大纲改为按任务分区组织：TaskDetailsModal 的各分区卡片（Description、References、Documentation、Modified Files、AC、DoD、Plan、Notes、Comments、Final Summary）打上 `id` + `data-toc-section`，`collectSectionedTocItems`（utils/toc.ts）把每个已渲染分区作为一级条目、内部标题嵌套其下，未渲染的分区不出现；无声明分区的页面回退为扁平标题收集，doc/wiki/decision 页不受影响。后续轮次陆续修复：滚动到底部时激活最后一个条目（Final Summary 可被高亮）、点击已可见条目时 pin 住高亮直到下一次真实滚动、位置规则跳过未选中的 tab 使被点击的 tab 拥有高亮。TabButton 新增 `tocLabel` prop 把 References/Documentation/Modified Files 注册为三个独立大纲条目，点击条目会先切换 tab 再滚动。

## 验证

结果：任务模态框具备按分区分组、可折叠、带 scrollspy 的 TOC；窄屏（<sm）下抽屉以 8px inset 覆盖模态框左缘、`max-w-[calc(100vw-8rem)]` 保证可关闭且不遮死内容；新增 `src/test/web-task-toc.test.tsx` 12 个测试（锚点稳定性、重复/CJK 标题、长大纲折叠、模态框 scrollspy、底部激活、点击 pin、tab 消歧、窄屏回退、分区分组），共 39 个 toc 相关测试通过。任务 Done（actual 2026-10-01 07:54→08:27）。

## Related Concepts

- [[concepts/web-ui-features]] — 任务详情模态框与 TOC 抽屉所属的 Web UI 功能面
- [[concepts/markdown-pipeline]] — MermaidMarkdown 的 github-slugger 标题锚点是 TOC 的收集基础
- [[concepts/toc-scrollspy]] — 模态框 TOC 抽屉、scrollspy 高亮与浮动模式双阈值所属概念

## Related Sources

- [[sources/back-638-header-outline-toc]] — 同一浮动折叠 TOC 模式在文档/decision/wiki 页上的先行实现（本任务的引用实现来自 BACK-726，其尚无 source 页）
