---
title: BACK-494 修复任务编辑模态框键盘快捷键与输入冲突
source_path: backlog/tasks/back-494 - Fix-task-edit-modal-keyboard-shortcuts-interfering-with-title-input.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, bug, web-ui, keyboard, ux]
---

# BACK-494 修复任务编辑模态框键盘快捷键与输入冲突

修复 `TaskDetailsModal` 全局键盘快捷键在用户在表单输入框中打字时仍然触发的问题。

## 问题描述

`TaskDetailsModal.tsx` 在 `window` 上注册了 capture 阶段 `keydown` 监听器，处理以下快捷键：
- `E` → 进入编辑模式
- `C` → 完成任务
- `D` → 降级为草稿
- `P` → 提升草稿
- `Ctrl/Cmd+S` → 保存
- `Escape` → 取消编辑

这些快捷键在焦点位于 `<input>`、`<textarea>` 或 `contenteditable` 元素时也会触发，导致无法输入与快捷键匹配的字符（如标题中输入字母 E）。

## 解决方案

创建可复用的 `isTypingTarget` helper（`src/web/utils/keyboard.ts`），在全局 keydown handler 顶部插入早期返回：

```ts
if (isTypingTarget(e)) return;
```

**Duck-typing 设计**：不使用 `instanceof HTMLElement`（在 Bun 测试运行器中不可用），而是通过 `typeof target === "object"` 后读取 `.tagName` 和 `.isContentEditable`，确保在非浏览器环境也可测试。

## 文件变更

- `src/web/utils/keyboard.ts` — 新增 helper
- `src/web/utils/keyboard.test.ts` — 单元测试（覆盖 input、textarea、contenteditable、普通 div、null target、非 HTMLElement 对象）
- `src/web/components/TaskDetailsModal.tsx` — 添加 guard + import

## Related Concepts

- [[concepts/web-ui-features]] — Web UI 交互与模态框

## Related Sources

- [[sources/demote-to-draft-action]] — BACK-419 降级为草稿功能（受影响的快捷键之一）
