---
title: BACK-488 修复 Wiki 粘贴图片保存时未迁移到永久目录
labels: [source, bug, wiki, web-ui, image-handling]
source_path: backlog/tasks/back-488 - Fix-wiki-pasted-images-not-moved-to-paste-directory-on-save.md
created_date: 2026-05-25 00:45
---

# BACK-488 修复 Wiki 粘贴图片保存时未迁移到永久目录

**状态**: Done | **标签**: bug, wiki, web-ui, image-handling | **负责人**: @kimi

## 问题

Wiki 页面在线编辑时粘贴的图片会被上传到 `.temp/` 临时目录，但保存页面时**未**执行 temp → paste 的迁移（promote），导致 `.temp/` 清理后图片链接断裂。

## 根因

任务和文档编辑器在 `handleSave` 中已包含图片 promote 逻辑（扫描 `/assets/.temp/` 引用 → 调用 `apiClient.promoteAssets` → 替换 URL → 再执行保存），但 `WikiDetail.tsx` 的保存流程遗漏了该步骤。

## 修复方案

- **文件**: `src/web/components/WikiDetail.tsx`
- 新增 `extractTempImageUrls` 和 `replaceTempImageUrls` 辅助函数（与 `TaskDetailsModal.tsx`、`DocumentationDetail.tsx` 保持一致）
- 更新 `handleSave`：
  1. 从 `editContent` 中提取 `/assets/.temp/…` URL
  2. 若存在，调用 `apiClient.promoteAssets(tempUrls)` 迁移到 `paste/`
  3. 替换 content 中的临时 URL 为永久 URL
  4. 更新 `editContent` state 使编辑器反映永久路径
  5. 继续正常 wiki 保存 API 调用 (`PUT /api/wiki/:path`)

## 关键设计

- **无后端变更**：复用现有 `/api/assets/promote` 端点和 `AssetManager.promote()` 方法
- **一致性**：Wiki 页面已使用 `PasteAwareMDEditor`，图片粘贴到 `.temp/` 正常工作；仅补充保存时的 promote 步骤

## Related Sources
- [[sources/paste-as-markdown-task]] — 原始 paste-as-markdown 任务，设计了 temp → paste 的完整图片迁移机制
