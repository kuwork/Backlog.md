---
title: BACK-666 - Web 任务模态框展示并编辑修改文件
labels: [source, web-ui, task-modal]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-666 - Show-and-edit-modified-files-in-the-web-task-modal.md
---

# BACK-666 - Web 任务模态框展示并编辑修改文件

`modifiedFiles` 字段已端到端贯通（parser、CLI、TUI、MCP、Web 搜索），但 Web 任务模态框从不展示它。本任务把 References、Documentation 与 Modified Files 合并为一个标签页元数据面板来浮出它，而不是加第三张堆叠卡片。

- `TaskDetailsModal.tsx` 中三个标签页替代两张堆叠卡片；条带带 `role="tablist"`/`tab`/`tabpanel`，只渲染活动标签页的内容，新列表不会把验收标准与字段挤到触达不到的地方
- 默认标签页跟随任务状态：`metadataTabPriorityFor(isDone)` 在已完成记录上把 Modified Files 放第一，否则 References 第一，首个非空列表胜出，References 兜底；`metadataTab` 状态为 `null` 表示"跟随任务"，规则在未保存编辑时重跑，点击只为该任务固定标签页
- 每个标题括号内带列表长度（`References(5)`），从渲染状态读取，计数跟随未保存编辑；空列表显示裸标题，无 `(0)`
- Modified Files 行克隆 References 行（等宽路径 chip 打开文件预览）去掉 URL 分支：模块内局部 `looksLikeUrl` 在提交时拒绝任何 `scheme://` 值，因此修改文件永远是项目根路径
- `modifiedFiles` 接入所有现有模态框管道（`buildTaskDetailsFormState`、保刷新同步、任务切换重置、`handleInlineMetaUpdate`、创建模式检查）并在 `handleSave` 中发送——与移植的上游版本不同，上游会丢掉创建时添加的路径
- 相对上游 BACK-633 移植的 fork 差异：标签页面板而非第三张堆叠卡片、所有字符串走 i18n、文件列表无 `max-h-64` 高度上限
- 测试：新增 18 用例 `web-task-details-modal-modified-files.test.tsx` 加更新的文档用例；在 BACK-664/BACK-666/BACK-438 上对照源服务器以 en 和 zh-CN 实测验证

## 验收标准

- References、Documentation 与 Modified Files 渲染为一个面板的三个标签页；只渲染活动标签页内容
- 默认标签页由状态驱动（已完成任务 Modified Files，否则 References），跟随未保存编辑，点击按打开的任务覆盖
- Modified Files 复用 References 行/表单渲染，拒绝 URL 输入且永不渲染为外部链接
- 跨分支与 completed 语料任务的列表按 References 门控同样只读渲染
- 标题带列表计数且无 `(0)`；新 i18n key 存在于全部四种语言，无硬编码字符串

## Related Concepts
- [[concepts/web-ui-features]] — 任务模态框结构与内联编辑约定
- [[concepts/file-preview]] — 复用自 References 的打开文件预览路径 chip
- [[concepts/i18n-string-fragmentation]] — 本任务让每个字符串走 i18n 而避免该问题，与被移植版本不同

## Related Sources
- [[sources/back-628-task-hierarchy-section]] — 同级任务模态框小节工作；同一模态框与钻取管道
- [[sources/back-665-completed-corpus-filter-checkbox]] — 本面板遵守的 completed 语料只读门控（批次兄弟）
