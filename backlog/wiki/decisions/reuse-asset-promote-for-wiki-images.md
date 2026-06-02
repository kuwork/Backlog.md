---
title: Wiki 图片 Promote 复用现有 Asset API
decision_date: 2026-05-24
labels: [decision]
created_date: 2026-05-25 00:45
updated_date: 2026-05-25 00:45
---

# Wiki 图片 Promote 复用现有 Asset API

## 决策

在 BACK-488 修复 Wiki 编辑器粘贴图片未迁移的问题时，**复用现有的 `/api/assets/promote` 端点和 `AssetManager.promote()` 方法**，不新建后端逻辑或专用端点。

## 上下文

- 任务和文档编辑器已实现了完整的 temp → paste 图片迁移流程
- Wiki 编辑器已使用 `PasteAwareMDEditor`，图片粘贴到 `.temp/` 正常工作
- 缺失的仅是保存时的 promote 步骤

## 评估的替代方案

| 方案 | 说明 | 结果 |
|---|---|---|
| **复用现有 API**（选中） | 前端在 `WikiDetail.handleSave` 中调用 `apiClient.promoteAssets`，后端无变更 | ✅ 最小侵入，一致行为 |
| 新建 Wiki 专用 promote 端点 | 如 `POST /api/wiki/promote-images` | ❌ 后端冗余，与任务/文档逻辑重复 |
| 后端自动 promote | 在 `updateWikiPage` handler 中自动扫描并迁移临时图片 | ❌ 破坏后端统一性，其他端点不这样做 |

## 理由

- 后端 `AssetManager.promote()` 已设计为通用资源迁移工具，不区分任务/文档/Wiki
- 前端统一处理 promote 后调用保存 API，与现有编辑器模式一致
- 零后端变更 = 零回归风险

## 影响

- `src/web/components/WikiDetail.tsx` 新增 `extractTempImageUrls` 和 `replaceTempImageUrls` 辅助函数
- 保存流程与 `TaskDetailsModal.tsx`、`DocumentationDetail.tsx` 保持一致

## Related Sources
- [[sources/wiki-pasted-images-promote-fix]]
- [[sources/paste-as-markdown-task]]
