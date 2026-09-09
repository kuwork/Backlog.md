---
title: defaultEditor 清空用空值跳过校验并改用 undefined 守卫
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# defaultEditor 清空用空值跳过校验并改用 undefined 守卫

## 背景

BACK-586 处理 `defaultEditor` 被显式清空（设为空值）的场景。清空后不应再走 `isEditorAvailable` 校验——校验一个被用户明确清空的编辑器没有意义。

## 决定

- init 守卫从 truthiness 判断改为 `!== undefined` 判断。
- 回退链从 `||` 改为 `??`。

显式空值跳过 `isEditorAvailable` 校验。

## 理由

- 真值回退（`||`）会吞掉显式空标志：空字符串是 falsy，`a || b` 会直接落到 b，用户的"清空"意图被静默覆盖。
- `!== undefined` + `??` 只关心"是否表态"，falsy 但已表态的值（如空字符串）得以保留并传播。

## 被否方案

- **保留 truthiness 守卫与 `||` 回退**：显式空值被当作未表态，清空配置永远落不到下游。

## Related

- [[sources/back-586-clear-default-editor]]
- [[concepts/cli-entry]]
- [[concepts/core-architecture]]
