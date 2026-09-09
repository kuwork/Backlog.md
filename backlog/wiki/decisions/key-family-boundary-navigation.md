---
title: 按键族信息随 GenericList 边界回调传递
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# 按键族信息随 GenericList 边界回调传递

## 背景

BACK-588/589 处理 TUI 列表的边界导航：到达列表顶部/底部时按键该做什么。vim 键（j/k）与方向键用户期望不同行为。

## 决定

让 GenericList 把按键族信息（arrow / vim）随边界回调传递给调用方：j/k 到达边界时停留原地，方向键到达边界时把按键移交给搜索输入。

同时，vim 键用 `picker.select()` 手动绑定 j/k，而非 blessed 的 `vi: true` 标志。

## 理由

- 按键族进入边界回调后，调用方可以按"用户用哪套键"给出不同行为，无需在 GenericList 内部硬编码策略。
- 手动绑定只覆盖 j/k，`vi: true` 还会附带绑定 l/q/g/G 等键，与 TUI 其余列表的行为不一致。

## 被否方案

- **新增用户配置开关**：为一个本可按按键族自动判断的行为增加配置面，收益低维护高。
- **用 blessed `vi: true` 标志**：附带绑定了 l/q/g/G 等键，污染 TUI 其他列表的既有键位约定。

## Related

- [[sources/back-588-vim-keys-boundary-navigation]]
- [[sources/back-589-vi-navigation-filter-popups]]
- [[concepts/cli-tui]]
