---
title: BACK-557 - 防止浏览器快捷键拦截行内任务字段
labels: [source, web-ui, keyboard, bug]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-557 - Prevent-browser-shortcuts-from-intercepting-inline-task-fields.md
---

# BACK-557 - 防止浏览器快捷键拦截行内任务字段

修复全局任务详情快捷键：不再拦截行内可编辑控件中的普通文本输入，同时在可编辑目标之外仍保持生效。

## 实现要点

- 在 `src/web/components/TaskDetailsModal.tsx` 中新增感知祖先的可编辑目标谓词，覆盖 `input`、`textarea`、`select` 与 `content-editable`（含经 `closest()` 匹配的嵌套后代）
- 仅用该谓词门控预览模式的 `e`/`E`/`c`/`d`/`p` 快捷键分支；编辑模式的 `Escape` 与 `Cmd/Ctrl+S` 分支在可编辑字段内保持可用
- 将守卫移至编辑模式分支之后，原先处理器顶部的守卫不再错误拦截编辑模式快捷键
- 新增聚焦的键盘测试，验证可编辑目标保留字面按键、非编辑目标快捷键保持激活

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 任务编辑与键盘行为

## Related Sources
- [[sources/task-edit-modal-keyboard-fix]] — BACK-494 快捷键与输入冲突修复
