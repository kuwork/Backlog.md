---
title: BACK-748 - 侧边栏 resize handle 被 hr preflight 压塌
labels: [source, bug, web-ui]
created_date: 2026-10-07 22:50
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-748 - Fix-sidebar-resize-handle-collapsed-by-hr-preflight-height-0.md
---

# BACK-748 - 侧边栏 resize handle 被 hr preflight 压塌

## 问题

Web 侧边栏右侧 hover 不再出现蓝色拖拽条，导致宽度无法调整。根因：BACK-723 的语义标签重构把 resize handle 的 `<div>` 改成了 `<hr border-0>`；Tailwind v4 preflight 自带 `hr{...height:0}`（元素选择器），而绝对定位的拉伸只有在 height 为 auto 时才生效，于是 handle 坍缩成 4px 宽、0 高的薄片。

## 解决方案

- **修复**：在 `src/web/components/SideNavigation.tsx` 的 hr handle 上加 `h-full`（类选择器压过元素选择器的 height:0）与 `aria-orientation="vertical"`（含注释说明为何需要 h-full）

## 验证

handle 实测 4×569、命中测试正确、合成拖拽 320→435 落盘到 localStorage；tsc/biome 干净；SideNavigation 测试 22 pass

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 组件与交互修复

## Related Sources
- [[sources/back-723-biome-tsx-coverage]] — 引入回归的 BACK-723（语义标签重构改 div→hr）
- [[sources/back-747-memo-archiving]] — 同期 Web UI 修复波次
