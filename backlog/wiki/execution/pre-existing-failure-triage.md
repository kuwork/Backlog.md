---
title: 预存测试失败分诊方法
created_date: '2026-09-08 17:00'
updated_date: '2026-09-26 14:45'
labels: [execution, testing]
extracted_from:
  - "[[sources/back-596-fail-closed-document-decision-identity]]"
  - "[[sources/back-597-fix-cli-test-failures-doc-update-path-task-list-grouping]]"
  - "[[sources/back-599-gray-matter-no-cache-parse-wrapper]]"
  - "[[sources/back-600-query-tasks-local-fast-path]]"
  - "[[sources/back-601-core-browser-publication-ownership]]"
  - "[[sources/back-602-incremental-cross-branch-task-loading]]"
  - "[[sources/back-612-content-store-test-stabilization]]"
  - "[[sources/back-701-fix-server-test-keep-alive-misroute]]"
  - "[[sources/back-687-milestone-board-tui]]"
  - "[[sources/back-684-task-detail-popup-backdrop-resize]]"
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

## 本波（653–714）新实例

- **BACK-701**：本地 server 套件 33 pass / 78 fail 看似大回归；用 stash 探针在干净 HEAD 复现同一失败集，确认为 Bun 1.3.14 keep-alive 路由的 pre-existing 平台问题，修在测试基础设施而非产品
- **BACK-687**：`mcp-milestones` 在本工作区有一个 pre-existing 失败（`git branch --show-current` / not a git repository，缺 git worktree admin 目录），与改动无关，记录后放行
- **BACK-684**：全量 `bun test` 的失败为 pre-existing 的 `tmp/` 孤儿与无关套件，判别靠"回退后恰好新用例红、邻近套件全绿"
- 回退探针本身也可能暴露覆盖缺口而非仅验证——见 [[execution/revert-matrix-verification]]（BACK-699 变体 D 全绿后补用例）

## Related Concepts

- [[concepts/ci-platform-contracts]] — CI 平台契约测试策略
