---
title: BACK-632 - 保存决策时提升粘贴图片
labels: [source, web-ui, decisions, assets]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-632 - Promote-pasted-images-when-saving-a-decision.md
---

# BACK-632 - 保存决策时提升粘贴图片

Web 决策编辑器挂载 PasteAwareMDEditor，它把粘贴的图片上传到 `assets/.temp`，但 `DecisionDetail.handleSave` 持久化正文时不做提升——30 分钟临时清理后图片就断了。其他所有 markdown 界面早已先做提升；本任务用同样方式修复决策。

- 仅 `DecisionDetail.tsx`：`handleSave` 的更新分支现在执行 `normalizeMarkdownHashLinks` → `extractTempImageUrls` → `apiClient.promoteAssets` → `replaceTempImageUrls` → `setContent` → `apiClient.updateDecision`，对齐 `TaskDetailsModal.handleSave`
- 提升后的正文在更新调用前写回编辑器状态，保存失败时针对永久 URL 重试，而不是重复提升已移动的文件
- 新建分支、标题校验与成功/错误处理未动；无粘贴图片的决策保存行为与之前完全一致（不调用 promoteAssets）
- 记录测试陷阱：`updateDecisionFromContent` 只读取 Context/Decision/Consequences/Alternatives 小节，因此任何标题之前的内容会被有意丢弃
- 阻塞性发现（未在此修复）：决策编辑器不可达——Edit 按钮被 `{false ? ... : null}` 守卫硬禁用，`?edit=true` 在挂载约 1.3 秒后被 `[id, decisions]` effect 取消——所以该修复直到 BACK-633 才可达
- 在真实浏览器中用上传的临时资产验证：存储正文指向 `/assets/paste/<uuid>.png`，`.temp` 文件已消失

## 验收标准

- 保存决策时把每个 `/assets/.temp` 图片提升到 `assets/paste`，与任务描述处理一致
- 提升后的正文写回编辑器状态，保存失败可安全重试
- 新建路径、标题校验与哈希链接归一化不变
- 无粘贴图片的决策完全跳过 promoteAssets

## Related Concepts

- [[concepts/asset-management]] — 本界面缺失的临时资产生命周期与提升
- [[concepts/paste-as-markdown]] — 产生 `.temp` URL 的 PasteAwareMDEditor 上传行为
- [[concepts/markdown-pipeline]] — 按小节解析的决策内容解析

## Related Sources

- [[sources/back-631-comment-rich-markdown-editor]] — 紧接其前为评论修复的同类缺陷
- [[sources/back-633-decision-editing-web-ui]] — 重新启用使本修复可达的编辑界面
- [[sources/wiki-pasted-images-promote-fix]] — 同一提升模式在 wiki 页面的更早实例
