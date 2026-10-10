---
title: BACK-589 - 过滤器弹窗接入 vi 导航
labels: [source, tui]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-589 - Salvage-vi-navigation-from-PR-809-for-TUI-filter-popups.md
---

# BACK-589 - 过滤器弹窗接入 vi 导航

TUI 的单选过滤器弹窗（status、priority、milestone）与任务编辑器的 Status/Type/Priority 选择器过去只能用方向键导航，而 TUI 其他部分支持 j/k。现在 j/k 将选择器移动到相邻索引，像方向键一样在两端截断，Enter 返回 j/k 选中的值；帮助行会提示 j/k。

## 实现要点

- `src/ui/components/filter-popup.ts`：单选选择器通过 `picker.select((selected ?? 0) + offset)` 绑定 j/k，在两端截断，与方向键一致。
- 两个弹窗帮助行均更新为提示 j/k（多选弹窗是 GenericList，已支持 j/k 导航）。
- 单选截断、多选环绕，保留既有边界行为；未改变其他弹窗行为。
- `tui-vim-boundary-navigation.test.ts` 中的测试通过两个弹窗驱动真实按键事件（24 通过 / 0 失败）。

## 验收标准

- 单选弹窗与编辑器选择器加入 j/k；两端截断；Enter 返回 j/k 选中的值；多选帮助行提示 j/k；边界行为不变；真实按键测试覆盖两个弹窗。

## Related Concepts

- [[concepts/cli-tui]] — 过滤器弹窗与选择器键位约定

## Related Sources

- [[sources/back-588-vim-keys-boundary-navigation]] — 列表中共享的 vim/方向键键族处理
