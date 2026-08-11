---
title: BACK-546 浏览器标签过滤器按字母排序
labels: [source, web-ui, sorting, ux]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-546 - Sort-browser-label-filters-alphabetically.md
---

# BACK-546 浏览器标签过滤器按字母排序

让 Web UI 所有任务标签下拉以可预测的字典序展示，便于浏览选择。

## 问题

标签下拉按首次遇到的顺序（来自配置与任务）列出，无规律。

## 解决方案

参照上游 BACK-529，在 `src/utils/label-filter.ts` 中让 `collectAvailableLabels` 返回去重并按不区分大小写排序的标签，同时保留首次遇到的 casing。新增 `compareCodeUnits` 辅助函数，按小写 NFD key 排序去重标签，平局时回退到原始 code unit。排序与 locale 无关、对规范等价 Unicode（NFC/NFD）确定性。

## 实现位置

- `src/utils/label-filter.ts`、`src/web/components/LabelFilterDropdown.tsx`

## 测试

`src/test/label-filter.test.ts`（重音标签、NFC/NFD 等价）、`src/test/web-task-list-labels-menu.test.tsx`（无序 `[zeta, Alpha]` → 渲染 `[Alpha, beta, delta, zeta]`）。

## Related Concepts
- [[concepts/web-ui-features]] — 标签过滤器
- [[concepts/search-sequences]] — 标签分类

## Related Sources
- [[sources/label-color-customization-task]] — BACK-500 标签颜色
