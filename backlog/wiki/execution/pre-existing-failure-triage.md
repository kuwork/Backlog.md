---
title: 预存测试失败分诊方法
created_date: '2026-09-08 17:00'
updated_date: '2026-09-08 17:00'
labels: [execution, testing]
extracted_from:
  - "[[sources/back-596-fail-closed-document-decision-identity]]"
  - "[[sources/back-597-fix-cli-test-failures-doc-update-path-task-list-grouping]]"
  - "[[sources/back-599-gray-matter-no-cache-parse-wrapper]]"
  - "[[sources/back-600-query-tasks-local-fast-path]]"
  - "[[sources/back-601-core-browser-publication-ownership]]"
  - "[[sources/back-602-incremental-cross-branch-task-loading]]"
  - "[[sources/back-612-content-store-test-stabilization]]"
---

# 预存测试失败分诊方法

本仓库 `bun test` 全量运行长期存在约 39 个 pre-existing 无关失败。验证门禁不依赖全量测试，而是 **scoped tests + tsc + biome + build**。在评估"我的改动是否引入新失败"时，需要一套分诊手法把 pre-existing 失败与真实回归区分开。

## 分诊手法

### ① git stash 探针法

怀疑某失败与本次改动无关时：`git stash` 后在干净 HEAD 上复现同一失败。能在 HEAD 复现 → 确认 pre-existing，与本次改动无关。

### ② HEAD baseline worktree 对照

开一个独立 worktree 检出 HEAD 并运行同一测试子集，作为基线对照组，排除工作区状态污染。

### ③ 全量运行计数基线对比

记录全量运行的 pass/fail 计数基线（如 2049 pass / 9 fail），改动后全量重跑：失败数不增、且原失败集合不变即证明无新增回归；失败消失还需确认不是测试被误删。

### ④ 回归测试反向验证

新增回归测试必须"先红后绿"：在临时回退被测实现后新测试应变红，恢复实现后变绿。跳过这一步的"回归测试"可能只是恒绿测试。

### ⑤ JSDOM 全局泄漏钉桩

JSDOM 环境下 `window.location.origin` 等全局值会被测试间泄漏污染。用 `beforeEach` 把 origin 钉到期望值，文件级 `afterEach` 恢复原始值，避免顺序依赖的偶发失败。

## Related Concepts

- [[concepts/ci-platform-contracts]] — CI 平台契约测试策略
