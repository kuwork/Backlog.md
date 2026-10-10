---
title: BACK-663 - completed 语料弹窗只读渲染加提示
labels: [source, web-ui, completed-corpus, i18n]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-663 - Render-completed-corpus-task-popups-read-only-with-a-corpus-hint.md
---

# BACK-663 - completed 语料弹窗只读渲染加提示

BACK-662 让搜索对话框能打开 `backlog/completed/` 记录，但弹窗仍按可编辑的看板记录构建——只读门控只以 `task.branch` 为键，而已完成记录带着 `source: "completed"`、没有 branch 到达，于是 Edit、内联字段编辑、评论增删、AC/DoD 开关对一个没有刷新路径的记录全部生效。本任务让 completed 弹窗获得跨分支弹窗已有的同款只读处理。

- 门控拆分在 `TaskDetailsModal.tsx`：`isFromOtherBranch = Boolean(task?.branch)` 保留 branch 原因的命名；`isReadOnly = isFromOtherBranch || task?.source === "completed"` 是现在每个守卫子句、操作按钮条件、`disabled` prop 以及透明度/光标样式读取的值——completed 弹窗继承跨分支锁定，而不是第二套手写实现
- Banner 仍是标题栏正下方的单一槽位；`isReadOnly` 时渲染并按原因选措辞——已完成记录用新的 `taskDetails.completedCorpusHint`，跨分支用 `crossBranchHint(task.branch)`
- i18n：`completedCorpusHint` 加入全部四种语言（en、zh-CN、zh-TW、ja）；`TranslationDict` 由 en 推导，四种语言都带上该 key 之前 tsc 会失败
- 回退探针一次只回退一半：把门控回退为仅 branch 使新用例变红；单独回退 banner 复现了确切的旧症状（"Read-only: This task exists in the  branch"，branch 为空）
- 已知共享限制保留：预览模式下 AC 复选框来自 `AcceptanceCriteriaEditor` 且 `disableToggle={isCreateMode}`，在只读弹窗上它们看起来仍可点击并静默无操作——跨分支弹窗今天行为相同；若两者都应彻底禁用，有一行跟进可做
- 验证：全部 29 个 Web 套件（172 个测试）绿，外加 headless Chrome over CDP 显示本地化提示，且从 completed 搜索打开 BACK-1 时操作按钮为零

## 验收标准

- `source: "completed"` 的任务以只读打开：无 Edit、无内联字段编辑、无评论增删、无 AC/DoD 开关
- 提示渲染在标题栏下方的跨分支 banner 槽位，点名已完成归档
- 跨分支任务保留 branch 提示并保持只读；活跃看板任务照旧可编辑打开
- 新提示字符串存在于全部四种 Web 语言

## Related Concepts
- [[concepts/web-ui-features]] — 任务模态框只读门控约定
- [[concepts/web-ui-i18n]] — 以英文类型为键的四语言字典
- [[concepts/task-lifecycle]] — 已完成归档作为只读面

## Related Sources
- [[sources/back-662-completed-corpus-query-search]] — 依赖：浮出本弹窗渲染的已完成记录的查询
- [[sources/back-664-dependency-input-completed-predecessors]] — 依赖 chips 点击穿透到本只读处理
- [[sources/back-567-cross-branch-task-identity]] — 被复用锁定形态的跨分支弹窗
