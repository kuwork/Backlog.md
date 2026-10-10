---
title: BACK-641 - 修复侧边栏折叠开关被页头遮挡
labels: [source, web-ui]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-641 - Fix-sidebar-collapse-toggle-hidden-behind-the-page-header.md
---

# BACK-641 - 修复侧边栏折叠开关被页头遮挡

Web UI 侧边栏折叠开关锚在侧边栏右边框上（`absolute -right-3`），所以约 11px 落在页头列内。页头（`relative z-20`，不透明）画在侧边栏（`z-10`）之上，只露半个圆，悬出的一半不响应点击。修复把侧边栏容器提到 `z-30`，使跨边框的开关画在页头之上。

- 根因：两个 z-index 在根堆叠上下文竞争，因为页头的父列未定位，`z-20` 页头胜过 `z-10` 侧边栏并盖住开关右半
- `src/web/components/SideNavigation.tsx` 一行修复：侧边栏容器 `z-10` -> `z-30`，注释说明开关为何必须高过页头
- 侧边栏子元素（resize 把手 z-20，ghost/下拉 z-50）不受影响，因为它们活在新的堆叠上下文内；模态框/toast/lightbox 是外部的 z-50
- 用 Chrome CDP 命中测试加真实鼠标事件验证：`z-10` 时开关最右像素属于页头 `nav`；`z-30` 时所有探测点命中按钮，点击悬出部分可展开/折叠侧边栏（64px <-> 320px）
- 已知权衡：视口窄于约 672px（页头本已溢出处）时侧边栏可能盖住页面 TOC 面板一条；修复需要把开关 portal 化，判定不值得
- 门禁：`bun run check .` 0 错误，`bunx tsc --noEmit` 干净，定向测试 web-side-navigation-loading（5）与 web-toc（23）通过

## 验收标准

- 开关在展开与折叠态都完整可见
- 开关的每个部分，包括悬在页头列上的半边，都可点击
- 侧边栏 resize 把手、页头布局与页面 TOC 面板保持工作

## Related Concepts

- [[concepts/web-ui-features]] — 本堆叠修复所维护的侧边栏与页头布局约定

## Related Sources

- [[sources/sidebar-collapse-button-fix]] — 同一组件区域的早期侧边栏折叠按钮修复
- [[sources/sidebar-resize-search-task]] — 须与本修复共存的侧边栏 resize 把手（z-20 堆叠）
