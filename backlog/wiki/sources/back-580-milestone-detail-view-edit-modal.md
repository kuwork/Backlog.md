---
title: BACK-580 - 里程碑详情视图与编辑模态框
labels: [source, web-ui, api, milestones, i18n]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-580 - Add-milestone-detail-view-and-redesign-milestone-edit-modal-modeled-on-task-detail-edit-page.md
---

# BACK-580 - 里程碑详情视图与编辑模态框

为 Web UI 里程碑提供完整详情视图（`/milestone/:id`，类似任务详情的 background-location 路由），并在成熟的 `TaskDetailsModal` 参考实现上重新设计新增/编辑模态框（预览/编辑模式、`PasteAwareMDEditor` 描述编辑、MermaidMarkdown 预览、脏检查、Ctrl/Cmd+S、内联日期保存）。此前里程碑只有卡片列表和简单模态框，描述完全无法从 Web 编辑。

## 实现要点

- 后端：`src/server/index.ts` 的 `handleUpdateMilestone` 现在将 `description` 传给 `MilestoneHandlers.editMilestone`（`undefined` = 不变，与创建一致）；SPA 回退覆盖 `/milestone/:id` 及子路径；`src/test/server-search-endpoint.test.ts` 中的新服务器测试验证 PUT 将描述持久化到 `## Description` 小节、省略则不动它。
- 前端：新的 `MilestoneDetailsModal.tsx`——一个共享组件承载预览/编辑模式（经详情标题栏的 Edit 按钮进入），max-w-5xl；MermaidMarkdown 描述带空占位；五个日期字段在两种模式下都可内联编辑（due/planned 用 `type=date`，actual 用 `datetime-local`，经 `storedUtcToDateTimeLocal`/`formatStoredUtcDateForDisplay`）；底部任务列表复用 `MilestoneTaskRow` + 可排序表头显示全部任务。
- `MilestoneAddModal.tsx` 抽出，带 `PasteAwareMDEditor` 描述字段，保存前 `promoteAssets`（`POST /api/assets/promote`）；共享 `src/web/utils/temp-assets.ts` 从 TaskDetailsModal 提取。
- 头部操作镜像任务模态框：Cancel/Save（编辑）和 Cancel/Create（新增）位于模态框头部右上角，用任务模态框按钮样式；Add 表单移除了底部按钮行。
- 与任务详情一致的脏状态：描述脏时 Esc/Cancel/X 需确认，外加 `onClickCapture` 链接拦截器（移植自 `TaskDetailsModal.confirmNavigationAwayFromEdits`），守卫看板/列表头部链接和描述中的任务/草稿链接。
- 卡片 Edit 按钮变为导航到 `/milestone/:id` 的 Detail 按钮；旧卡片编辑模态框、其状态/处理器、`findDuplicateMilestone` 和 `editTitle` locale 键被移除。
- Archive 按钮获得专门的 `archiving` 状态，内联元数据保存不再闪现 archiving 标签。
- 健壮性修复：`editMilestone` 中的重命名级联曾吞掉失败任务的身份和原因——现在报告失败任务 ID、底层锁/错误原因和回滚失败（`src/mcp/tools/milestones/handlers.ts`）。测试中找到的根因：重命名撞上另一进程持有的快速失败任务锁（BACK-571）；回滚恢复了里程碑文件，无数据丢失。
- i18n：四个语言环境（en、zh-CN、zh-TW、ja）新增 `t.milestones.*` 字符串。
- 验证：完整 bun test 2161 pass / 0 fail / 14 skip；tsc 和 biome 干净；重建二进制并冒烟测试。

## 验收标准

- 点击里程碑卡片标题打开 `/milestone/:id`，展示标题、渲染描述、五个日期、进度和完整任务列表；预览/编辑共享一个组件，与任务模态框对齐（脏检查、Ctrl/Cmd+S、Esc 抑制）。
- 编辑模态框含 PasteAwareMDEditor + 五个日期字段；保存先调 promoteAssets 再 PUT；描述持久化到 `## Description`；剪贴板图片粘贴上传并渲染。
- en/zh-CN/zh-TW/ja 语言字符串齐全；bun test、tsc、biome 全部通过。

## Related Concepts

- [[concepts/milestones]] — 里程碑模型、任务级联与归档语义
- [[concepts/web-ui-features]] — 详情视图路由模式与卡片操作
- [[concepts/paste-as-markdown]] — PasteAwareMDEditor 编辑与剪贴板图片 promote
- [[concepts/asset-management]] — temp-assets 提取与 promote 流程
- [[concepts/date-fields]] — 带本地/UTC 转换的五个里程碑日期字段
- [[concepts/web-ui-i18n]] — 四语言字符串新增

## Related Sources

- [[sources/back-515-milestone-update-fix]] — 之前的里程碑 Web API 修复
- [[sources/m-6-new-milestones-ui]] — 本工作归属的里程碑（同批次）
