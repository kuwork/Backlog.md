---
title: doc-10 - 上游 v1.49.3→v1.50.1 迁移分析（按领域）
labels: [source, migration, upstream]
created_date: 2026-09-08 17:00
updated_date: 2026-10-09 23:30
source_path: backlog/docs/migration/doc-10 - v1.49.3-至-v1.50.1-上游任务迁移分析报告（按领域）.md
---

# doc-10 - 上游 v1.49.3→v1.50.1 迁移分析（按领域）

对 doc-9 中所有 A/B 条目的逐项深度分析，覆盖上游 v1.49.3..v1.50.1 区间。全部 26 个条目（CLI-1..13、TUI-1..8、WEB-1..4、SVR-1..2、CI-1）按六个维度分析——目的、变更摘要、fork 交集风险、可复用内容、排除项、优先级与迁移建议（①复用 / ②重写 / ③跳过）——并附上游 merge commit 与 fork 工作区双侧的 file:line 证据。上游原始任务以草稿导入（draft-90..draft-125），迁移为 BACK-571..BACK-615，全部 Done。

报告要点：

- 方法：四个领域并行分析（CLI/Core、TUI、Web、Server+Infra），将每条上游 merge commit 差异与 fork 工作区逐文件对比。
- CLI-1（BACK-575→571）：`withTaskLock`/`withLockTarget`/`TaskLockError` 位于 `src/file-system/operations.ts`；`updateTaskFromInput` 在锁内重读（`src/core/backlog.ts`）；MCP 将锁错误映射为 OPERATION_FAILED；锁顺序固定为任务锁 → create 锁。
- CLI-2（BACK-583→579）：`defaultAssignee` 在 `createTaskFromInput` 中生效（`resolvedAssignees = normalizedAssignees.length > 0 ? ... : normalizeStringList(config?.defaultAssignee) ?? []`），string→string[] 类型升级，覆盖 CLI/wizard/TUI/web/MCP。
- CLI-4（BACK-572/586/618→577）：`--clear-deps/--clear-refs/--clear-docs`，并在 edit 时拒绝空的 `--dep ""`/`--ref ""`/`--doc ""`；create 仍拒绝空值。
- CLI-10（BACK-623/624→600/601/602）：local-first CLI 读取先行落地，随后 BACK-601 完成 BACK-559 的 publication-owner / batchTaskUpdates / transitionTask 基础，BACK-602 再移植完整 BACK-624（tip 快照、共享缓存、bounded fetch、ref leases、MCP 搜索本地路径）。
- WEB-1（BACK-617→573）：Chromium 在 dragstart 同步显示隐藏列时中止原生拖拽——修复将显示推迟一个 macrotask；fork `Board.tsx:658` 存在完全相同的 bug 模式。
- WEB-4（BACK-614/604→584）：三态负责人负载——缺省应用 defaultAssignee，显式 `[]` 表示未指派；CLI 新增 `--unassign`，`-a ""` 报错并给出提示；web 表单预填 defaultAssignee chips，清空 chips 时发送显式 unassign。
- SVR-1（BACK-580/602→596）：fail-closed 的文档/决策标识（AmbiguousDocumentIdError 风格），在 `loadDecision` 中取代文件名前缀匹配、在 `getDocument` 中取代静默首个匹配，并附带 doctor 诊断。
- SVR-2（BACK-613→595）：content-store 文档监视器不再无限重试 `doc-1` 式命名，按路径发布零填充 ID 重命名，`strandedEquivalent` 触发全量刷新回退。
- TUI 条目（BACK-565→587 composer UX、584/616→588/589 vim 键、615→590 hideEmptyColumns、577→591 窗口标题、609→592 doc --plain、620→594 footer 提示、581/605→593 BACKLOG_CWD/运行时 cwd）凭 fork 工作区证据晋升为 A 级真实交互/正确性缺陷。

## 验证

不适用（分析报告）；交付物为逐条分析表加上游 merge commit 与 fork 工作区双侧的 file:line 证据。

## Related Concepts

- [[concepts/upstream-migration]] — 「分类 → 分析 → 草稿导入 → BACK-5xx/6xx 迁移」流水线的典范示例
- [[concepts/task-identity]] — SVR-1 把 fail-closed 标识从任务（AmbiguousTaskIdError）扩展到文档与决策
- [[concepts/core-architecture]] — CLI-10 记录跨分支加载架构（publication owner、bounded fetch、ref leases）

## Related Sources

- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — 本报告逐项分析所依据的分类索引
- [[sources/doc-8-upstream-v1-49-3-migration-analysis-by-domain]] — 上一波迁移的领域分析，同为六维方法
