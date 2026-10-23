---
title: BACK-817 - 修复子目录文档的 bare ID 文档视图
labels: [source, cli, doc, bug]
created_date: 2026-10-23 17:20
updated_date: 2026-10-23 17:20
source_path: backlog/tasks/back-817 - Fix-doc-view-failing-on-bare-IDs-for-subdirectory-documents.md
---

# BACK-817 - 修复子目录文档的 bare ID 文档视图

BACK-598 引入的回归修复：用裸 ID（如 `doc-20` 或 `20`）查看**子目录**下的文档时，`backlog doc view` 报 "Document not found"。

## 根因

`findDocumentByReference`（[[sources/back-598-doc-view-disambiguate-path-title-slug]]）只为歧义副作用调用 `findDocumentById`，却丢弃其返回值。无冲突时，按裸 ID 命中的文档永不返回，查找落到路径词干与标题 slug 形式——它们的键从不含裸 ID，于是函数返回 null。

根级文档（如 `doc-1 - Title.md`）的词干恰好等于 `doc-1`，裸 ID 能走路径形式解析；所有既有测试都用根级文档，因此掩盖了 bug。子目录文档（如 `memos/doc-20 - ....md`）词干是 `memos/doc-20`，裸 ID 必然落空。

## 改了什么

- `src/utils/document-id.ts`：捕获 byId 结果，非冲突时直接返回
- `src/test/cli-doc-view.test.ts`：回归测试，子目录文档经两种裸 ID 形式（`doc-20` 与 `20`）查看

冲突 ID 仍 fail-closed 抛 `AmbiguousIdError` 并给出候选提示。验证：`bun test` 10/10，`tsc --noEmit` 干净，对本仓真实数据 `doc view doc-20 --plain` 正常输出。

## Related Concepts

- [[concepts/cli-instructions]] — doc view 命令表面
- [[concepts/task-identity]] — 实体 ID 解析与 fail-closed

## Related Sources

- [[sources/back-598-doc-view-disambiguate-path-title-slug]] — 引入回归的文档视图消歧
- [[sources/back-596-fail-closed-document-decision-identity]] — 文档/决策身份歧义 fail-closed
