---
title: BACK-479 Web UI 路径自动补全与文档编辑
labels: [source]
source_path: backlog/tasks/back-479 - Web-UI-Full-documentation-editing-with-path-autocomplete-for-references-and-documentation.md
created_date: 2026-05-20 23:45
updated_date: 2026-05-20 23:45
---

# BACK-479 Web UI 路径自动补全与文档编辑

**状态**: Done | **标签**: feature, web-ui | **优先级**: medium

统一 TaskDetailsModal 中 references 与 documentation 的编辑体验：为两个字段添加共享的路径自动补全组件，并使 documentation 支持完整的增删改操作。

## 核心功能

- **文档编辑**：documentation 从只读升级为可增删改，交互模型与 references 一致
- **路径自动补全**：输入相对路径（如 `./` 或 `src/web/com`）时弹出下拉建议
  - 目录模式（输入含 `/` 或 `\`）：列出指定目录下的文件和文件夹
  - 全局搜索模式（无分隔符）：递归搜索项目树，最多返回 50 个匹配
- **键盘导航**：上下箭头移动选择，Enter 确认，Esc 关闭，左右箭头进入/返回目录
- **安全限制**：路径解析严格限制在项目根目录，拒绝 `../`、绝对路径和越界路径

## 技术实现

- `src/file-system/operations.ts`：新增 `listProjectFiles()`，带路径包含检查
- `src/server/index.ts`：新增 `GET /api/list-files` 端点
- `src/web/components/PathAutocomplete.tsx`：共享自动补全组件，支持前缀优先的子串匹配排序
- `src/web/components/TaskDetailsModal.tsx`：documentation 区域完全可编辑，集成 PathAutocomplete

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/asset-management]] — 资源管理
- [[developer-notes/security-gotchas]] — 安全检查清单（路径遍历防护）
