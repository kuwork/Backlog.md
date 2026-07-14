---
title: BACK-526 修复创建任务引用输入与 .backlog 路径自动补全发现
labels: [source, bug, web-ui, cli, autocomplete]
created_date: '2026-07-14 06:20'
updated_date: '2026-07-14 06:20'
source_path: backlog/tasks/back-526 - Fix-create-task-references-input-and-backlog-autocomplete-discovery.md
---

# BACK-526 修复创建任务引用输入与 .backlog 路径自动补全发现

修复 Web 创建任务模态框无法添加 References，以及路径自动补全无法发现 `.backlog` 目录的两个问题。

## 问题

1. **References 输入在创建模式隐藏**：`TaskDetailsModal.tsx` 中 References 的添加表单被 `mode === "preview"` 条件限制，导致创建任务时无法输入引用。
2. **创建 payload 缺少 references / documentation**：即使 UI 允许输入，创建时提交的 payload 也未包含这两个数组。
3. **路径搜索过度隐藏点目录**：`searchProjectFiles` 用 `entry.name.startsWith(".")` 过滤所有点前缀目录，导致用户输入 `.back` 时无法发现 `.backlog` 目录。BACK-479 原意仅排除 `node_modules`、`.git`、`dist`、`build`、`.backlog`、`.locks` 等特定目录，但实现更严格。

## 解决方案

1. **显示 References 添加表单**：将条件从 `mode === "preview"` 放宽为 `!isFromOtherBranch`，与 Documentation 保持一致，创建和编辑模式均可添加引用。
2. **创建 payload 包含数组**：在 `handleSave` 的创建 payload 中加入 `references` 和 `documentation`。
3. **精确控制点前缀目录**：
   - 从 `excludeDirs` 中移除 `.backlog`
   - 遍历时仅当 `entry.name.startsWith(".") && entry.name !== ".backlog"` 才跳过
   - 其他点目录（如 `.github`、`.husky`）仍保持隐藏

## 实现位置

- `src/web/components/TaskDetailsModal.tsx`
  - References 添加表单条件移除 `mode === "preview"` 限制
  - `handleSave` 创建 payload 加入 `references`、`documentation`
- `src/file-system/operations.ts`
  - `searchProjectFiles` 调整点前缀目录过滤逻辑

## 测试

- TypeScript 检查通过
- Biome 格式/ lint 通过
- 相关文件系统测试通过

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 任务编辑与路径自动补全
- [[concepts/asset-management]] — 本地文件预览与引用管理

## Related Sources
- [[sources/path-autocomplete-task]] — BACK-479 路径自动补全原始实现
