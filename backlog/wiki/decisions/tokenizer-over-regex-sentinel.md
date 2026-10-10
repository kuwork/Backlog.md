---
title: AC/DoD 解析用 tokenizer 替代 regex 哨兵
labels: [decision, markdown, core]
created_date: 2026-08-09 00:00
updated_date: 2026-10-09 23:30
---

# AC/DoD 解析用 tokenizer 替代 regex 哨兵

## 决定

`src/markdown/structured-sections.ts` 将 regex 哨兵匹配替换为 tokenizer + 区间解析器：tokenize 所有已知哨兵、屏蔽外来族区间、配对 AC/DoD 标记、对歧义结构 fail-closed。

配套语义：

- `--ac`/`--acceptance-criteria` 在 task edit 保持叠加别名（task create 不变）
- 新增 `--clear-ac` 通过 `acceptanceCriteriaSet=[]` 原子清空，拒绝与其它 AC 变更选项组合

## 理由

- regex 哨兵匹配对畸形结构敏感，可能导致 AC/DoD 解析静默损坏
- tokenizer + 区间解析器使解析确定性化，对歧义 fail-closed（宁可报错也不猜测）

## Related Concepts

- [[concepts/markdown-pipeline]] — markdown 解析管线

## Related Sources

- [[sources/back-537-deterministic-checklist-serialization]] — 确定性清单序列化的落地任务
