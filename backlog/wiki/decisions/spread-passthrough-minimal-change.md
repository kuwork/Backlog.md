---
title: 新字段随 Spread 透传加集中式实质变更投影
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# 新字段随 Spread 透传加集中式实质变更投影

## 背景

BACK-618/619 需要为模型（milestone）增加新字段并让其贯穿读写链路。直接在每个函数签名上加参数会让所有 caller 跟着改。

## 决定

默认模式：新字段随 `{...spread}` 透传，配合集中式的"实质变更"投影——零函数签名改动即覆盖所有 caller，且自动刷新 `updated_date`。

BACK-619 例外：`fs.updateMilestone` / `createMilestone` 的位置参数重构为 options 对象，吸取 BACK-618 的教训：位置参数脆弱，插一个字段就要动所有调用点。

## 理由

- spread 透传 + 集中投影把"哪些字段算实质变更"的判定收敛到一处，新增字段无需传播签名。
- 集中投影处统一刷新 updated_date，不会有 caller 忘记更新的问题。
- options 对象让 milestone 更新接口对未来的字段扩展免疫。

## 被否方案

- **逐函数加位置参数**：BACK-618 已证明其脆弱——每次加字段都是全 caller 的连锁修改。
- **由 caller 各自刷新 updated_date**：分散且易漏。

## Related

- [[sources/back-618-milestone-created-updated-dates]]
- [[sources/back-619-milestone-documentation-field]]
- [[concepts/milestones]]
- [[concepts/core-architecture]]
