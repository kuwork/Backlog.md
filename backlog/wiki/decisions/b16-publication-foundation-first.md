---
title: B16 先补 Publication 地基再整体移植 BACK-624
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# B16 先补 Publication 地基再整体移植 BACK-624

## 背景

B16 方案 1（doc-9）：上游 BACK-624 是一个拆分后的移植单元，直接忽略会丢掉一组重要修复。但 fork 此前只有 BACK-568 的轻量移植，缺 BACK-559 的 publication-owner 地基。

## 决定

不拆分忽略 BACK-624，改为两步：

1. BACK-601 先补全 BACK-559 的 publication-owner 地基：epoch、generations/versions、mergeConcurrentChanges。
2. BACK-602 再整体移植 BACK-624。

判断依据：559 → 624 是同一架构演进，而不是两个独立功能；fork 的 BACK-568 轻量移植缺地基，拆 624 只会让两个半成品拼在一起。

成果：warm 读取从 394 次 Git 操作降到 ≤3。

## 理由

- 地基（epoch/generations/mergeConcurrentChanges）是 624 的正确性前提，缺了地基移植 624 只会引入隐性 bug。
- 整体移植保持上游演进的完整性，避免在 fork 里重新发明半个 publication 层。
- 394 → ≤3 次 Git 操作的收益来自地基就位后的缓存读取路径。

## 被否方案

- **拆分忽略 BACK-624**：丢弃完整演进单元，warm 路径性能与并发正确性都得不到。
- **在不补 559 地基的情况下直接移植 624**：地基缺失使合并逻辑无法正确工作。

## Related

- [[sources/back-601-core-browser-publication-ownership]]
- [[sources/back-602-incremental-cross-branch-task-loading]]
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]]
- [[concepts/core-architecture]]
- [[concepts/browser-loading]]
- [[concepts/upstream-migration]]
