---
title: BACK-622 - 澄清 Web 里程碑归档与移除对话框
labels: [source, web-ui, milestones, i18n]
created_date: 2026-09-08 05:48
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-622 - Clarify-milestone-archive-remove-dialogs-in-the-web-UI.md
---

# BACK-622 - 澄清 Web 里程碑归档与移除对话框

里程碑归档操作使用原生 `window.confirm`，且移除对话框的文案对实际文件/任务影响语焉不详。用户无法清楚看出移除和归档都会把里程碑文件移入 archive，而只有移除会动任务文件。本任务把原生 confirm 换成样式化模态框，并用 4 种语言重写两个对话框的文案，缘起是用户对 BACK-619 里程碑文档界面的评审反馈。

- `MilestonesPage.tsx`：归档的 `window.confirm` 换成样式化确认模态框（`archivingBucket` 状态、蓝色 Archive 按钮），与移除模态框对齐；`MilestoneDetailsModal.tsx`：同样的模态框（`showArchive` 状态）接到现有的 handleArchive
- 文案决策：两个对话框都删掉多余的疑问句（“Remove milestone X?”），因为模态框标题已点明动作；归档描述用将来时聚焦关键保证——“Task files will not be modified; tasks will keep their reference to this milestone.”
- Clear 选项标签由 “Leave tasks unassigned” 改名为 “Clear the milestone field on tasks”（清空任务的里程碑字段）——“unassigned” 是界面分组名，但该操作字面意义就是清空任务文件上的里程碑字段
- `removeDescription`/`archiveDescription` 变为纯字符串（不再插值标签）
- i18n 在 en/zh-CN/zh-TW/ja 更新；测试更新到新文案（“Remove Milestone”、“Clear the milestone field on tasks”）；Web 里程碑套件 25 通过 / 0 失败

## 验收标准

- 归档在里程碑页和详情模态框上都显示样式化确认模态框，4 种语言全覆盖
- 移除与归档对话框文案说明文件移动与任务文件影响，且不把里程碑名重复为疑问句
- Web 里程碑测试套件通过

## Related Concepts

- [[concepts/milestones]] — 归档与移除语义（文件移动 vs 任务字段调整）
- [[concepts/web-ui-i18n]] — 四语文案重写与标签 vs 分组名的措辞精确性

## Related Sources

- [[sources/back-619-milestone-documentation-field]] — 触发本次文案澄清的评审反馈所在界面
