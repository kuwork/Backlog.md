---
title: autoCommit 精确文件提交但不移植临时索引 CAS 管线
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels: [decision, git, auto-commit]
---

# autoCommit 精确文件提交但不移植临时索引 CAS 管线

## 背景

上游 BACK-563 使用 `GIT_INDEX_FILE` 临时索引 + `commit-tree` + `update-ref` 的 CAS 管线实现精确路径提交。

## 决策

BACK-561 实现精确文件 autoCommit，但保留 fork 的 `git commit --only <paths>` 语义，不移植上游 CAS 管线。

## 理由

- `git commit --only` 已足够精确提交指定路径
- 避免引入大量 git 底层管线代码和维护负担
- 通过 `git diff --name-only -z --cached --no-renames` 获取 staged 路径，解决移动文件只提交一侧和非 ASCII 文件名问题
- 保留用户 staging 区，实现目标一致

## Related Sources

- [[sources/back-561-autocommit-exact-files]] — 实现
