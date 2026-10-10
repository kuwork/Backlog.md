---
title: BACK-631 - 评论输入框换成富 Markdown 编辑器
labels: [source, web-ui, comments]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-631 - Replace-the-web-comment-input-with-the-rich-markdown-editor.md
---

# BACK-631 - 评论输入框换成富 Markdown 编辑器

任务模态框的 Comments 分区是模态框中最后一块纯 textarea 界面，而描述、计划、备注与最终小结都已使用 PasteAwareMDEditor——且已保存的评论本就按 markdown 渲染。本任务把 textarea 换成共享编辑器，并删除冗余的评论专用自动补全管线。

- 仅 `TaskDetailsModal.tsx`：评论 textarea 换成 PasteAwareMDEditor（preview=edit，高 200，主题感知，placeholder 经 textareaProps），获得 markdown 工具栏、粘贴转 markdown、图片/docx 拖放上传与实体链接自动补全
- 删除共享编辑器使其冗余的评论专用接线：`commentTextareaEl` 状态、`commentAutocomplete` hook 调用、`EntityLinkAutocompleteMenu` 渲染及两个导入
- 经模块级 `COMMENT_EDITOR_COMMANDS` 过滤器从此编辑器移除 Insert-HR 命令，因为评论序列化器拒绝独立 `---` 行而该命令总是产生一条
- 后续修复（用户报告：粘贴的图片留在 `.temp`）：`handleAddComment` 现走任务描述的提升路径——`extractTempImageUrls` → `apiClient.promoteAssets` → `replaceTempImageUrls`——并把重写后的正文写回编辑器状态，保存失败重试时针对永久 URL
- 存储不变：评论存为 markdown 文本，作者字段独立，保留 `---` 拒绝守卫
- 在真实浏览器中用一次性任务验证：亮/暗主题、ID 前缀自动补全插入 markdown 链接、真实粘贴事件把 `/assets/.temp/<uuid>.png` 提升为 `assets/paste`；66 个模态框测试通过

## 验收标准

- 新评论输入框与任务描述使用同一富 markdown 编辑器，跟随模态框主题
- 作者输入框、保存/禁用状态、未保存草稿守卫与 `---` 拒绝不变
- 评论专用自动补全状态、菜单与导入已从 TaskDetailsModal 移除
- 粘贴进评论的图片在存储前从 `assets/.temp` 提升到 `assets/paste`

## Related Concepts

- [[concepts/task-comments]] — 编辑器必须遵守的评论存储与序列化规则
- [[concepts/paste-as-markdown]] — 共享编辑器提供的粘贴/拖放管线
- [[concepts/asset-management]] — 保存时应用的 `.temp` → `paste` 资产提升模式
- [[concepts/web-ui-features]] — 任务模态框编辑界面

## Related Sources

- [[sources/back-470-3-server-web-task-comments]] — 本编辑器替换其输入框的早期 Web 评论界面
- [[sources/back-617-preview-mode-comment-add]] — BACK-617 预览模式评论入口
- [[sources/back-632-decision-image-promotion]] — 同一潜在 `.temp` 缺陷随后在决策上的修复
