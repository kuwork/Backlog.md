---
title: BACK-617 - 任务详情视图直接添加评论
labels: [source, web-ui, comments]
created_date: 2026-09-07 08:25
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-617 - Add-comments-directly-from-task-detail-view.md
---

# BACK-617 - 任务详情视图直接添加评论

在 Web UI 中，添加任务评论只能在任务详情模态框的编辑模式下进行，用户仅为留言被迫进入编辑模式。现在只要任务在本地可编辑——含预览模式——评论表单即渲染，复用既有 server 评论追加 API；跨分支只读任务保持表单隐藏。

- `src/web/components/TaskDetailsModal.tsx`：评论表单在 `!isFromOtherBranch` 时渲染，不再限于编辑模式；`handleAddComment` 在编辑模式外不再设置 `preserveEditModeAfterCommentRefresh`，预览模式下添加后刷新数据而不切到编辑。
- 简化：移除 `preserveEditModeAfterCommentRefresh` ref（BACK-470 遗留）——跨刷新的模式保持现仅依赖 `modeRef`，同时修复"添加评论后取消编辑会把模态框强制拉回编辑模式"的边界情形。
- 评论作者输入框加 `placeholder-gray-400 dark:placeholder-gray-500`（暗色模式下原渲染为偏白色）。
- i18n：zh-CN/zh-TW `placeholderCommentAuthor` 由 作者/作者 改为 评论人/評論人；en/ja 不变。
- `src/test/web-task-details-modal-final-summary.test.tsx`：更新预览断言 + 新增预览模式添加测试；全量 bun test 2176 pass / 0 fail。

## 验收标准

- 任务详情页允许在预览（非编辑）模式直接添加评论。
- 提交后评论列表立即更新且模态框不切到编辑模式。
- 只读（跨分支）任务只显示评论列表而不显示输入表单。
- Web/server 测试覆盖从预览模式添加评论。

## Related Concepts

- [[concepts/task-comments]] — 评论追加流程与预览/编辑模式门控。
- [[concepts/web-ui-features]] — TaskDetailsModal 模式处理与跨分支只读行为。

## Related Sources

- [[sources/back-470-task-comments]] — 本任务放松其"仅编辑模式"门控的原始评论功能。
