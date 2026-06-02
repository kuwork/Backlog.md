---
title: 在编辑器保存流程中集成图片 Promote
labels: [execution]
created_date: 2026-05-25 00:45
updated_date: 2026-05-25 00:45
---

# 在编辑器保存流程中集成图片 Promote

## 场景

当编辑器支持粘贴图片（通过 `PasteAwareMDEditor`）时，图片会先被上传到 `.temp/` 目录。为避免临时文件清理后链接断裂，必须在保存时将图片迁移到永久目录 `paste/`。

## 标准步骤

1. **提取临时图片 URL**
   ```typescript
   const extractTempImageUrls = (text: string): string[] => {
     const matches = text.match(/\/assets\/\.temp\/[^)\s\\"']+/g);
     return matches ? [...new Set(matches)] : [];
   };
   ```

2. **调用 Promote API**
   - 若存在临时 URL，调用 `apiClient.promoteAssets(tempUrls)`
   - 后端将文件从 `.temp/` 移动到 `paste/`，返回 URL 映射

3. **替换内容中的 URL**
   ```typescript
   const replaceTempImageUrls = (text: string, mapping: Record<string, string>): string => {
     let result = text;
     for (const [oldUrl, newUrl] of Object.entries(mapping)) {
       result = result.replaceAll(oldUrl, newUrl);
     }
     return result;
   };
   ```

4. **更新编辑器状态**
   - 将替换后的内容写回 `editContent` state，确保编辑器显示永久 URL

5. **执行正常保存**
   - 调用原有的保存 API（如 `PUT /api/tasks/:id`、`PUT /api/wiki/:path`）

## 已应用的编辑器

- 任务编辑器 (`TaskDetailsModal.tsx`)
- 文档编辑器 (`DocumentationDetail.tsx`)
- Wiki 编辑器 (`WikiDetail.tsx`)

## 关键原则

- **无后端变更**：复用现有的 `/api/assets/promote` 端点和 `AssetManager.promote()` 方法
- **一致性**：所有使用 `PasteAwareMDEditor` 的编辑器都应执行相同的 save-time promotion 步骤

## 常见陷阱

- 遗漏保存时的 promote 步骤（如 BACK-488 中 Wiki 编辑器最初缺失此逻辑）
- 未更新 `editContent` state，导致编辑器中仍显示临时 URL

## 提取来源
- [[sources/paste-as-markdown-task]] — 原始机制设计
- [[sources/wiki-pasted-images-promote-fix]] — Wiki 编辑器补齐 promote 的修复
