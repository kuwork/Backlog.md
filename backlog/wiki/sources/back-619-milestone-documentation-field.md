---
title: BACK-619 - 里程碑 documentation 字段支持
labels: [source, milestones, cli, mcp, web-ui]
created_date: 2026-09-07 21:02
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-619 - Add-documentation-field-support-to-milestones-doc-add-doc-clear-docs.md
---

# BACK-619 - 里程碑 documentation 字段支持

里程碑无法链接设计文档或规格，而任务自早期版本就有 documentation 字段。本任务为里程碑新增 `documentation?: string[]` 并支持 CLI、MCP 和 Web UI，同时修复指南缺口（task-creation.md 从未解释 --add-doc/--clear-docs 家族）。一个关键架构事实塑造了实现：CLI milestone add/edit 委托给 MilestoneHandlers（与 MCP 和 Web 服务器共享），因此在 handlers 层实现一次文档解析即可同时覆盖三个面。

## 实现要点

- Core：`Milestone` 新增 `documentation?: string[]`；`parseMilestone`/`serializeMilestone` 往返该字段（frontmatter 键 `documentation`，为空时省略）；文档变更在 BACK-618 的可比投影中算实质性变更，因此 updated_date 免费刷新——应用了 BACK-618 的教训：字段搭 `{...milestone}` 展开的便车，而非扩展脆弱的按位置参数签名
- 签名重构：`fs.updateMilestone(identifier, title, options)` / `fs.createMilestone(title, options)` 改为接收 options 对象（MilestoneCreateOptions/MilestoneUpdateOptions）；所有调用点已更新（Core 包装器、任务状态自动填充、handlers 及回滚点、Web 服务器）
- Handlers：MilestoneEditArgs 增加 documentation/addDocumentation/removeDocumentation，本地解析器应用与 Core.updateTask 的 resolveDocumentation 完全相同的 set/add/remove 语义；MCP schema 镜像 task_edit 的描述
- CLI：`milestone add --doc`（可重复，空值经 validateClearableListInput 拒绝）；`milestone edit --doc/--add-doc/--remove-doc/--clear-docs`，沿用任务编辑的互斥规则
- Web：MilestoneDetailsModal 在 Description 下方新增 documentation 卡片（链接列表、逐项移除、预览与编辑模式均可见的 PathAutocomplete 添加输入框，对标 BACK-479 的 TaskDetailsModal.tsx:1292-1360 实现任务页一致性）；MilestoneAddModal 使用相同卡片布局；修复一个非法嵌套表单（内部文档表单在 HTML 解析中提前关闭外部创建表单——添加行现在是带 type=button 的 div）
- 指南：cli-instructions/milestones.md、mcp/milestones.md、agent-guidelines.md 记录新选项；task-creation.md 缺口修复（补充 --add-doc/--remove-doc/--clear-docs 说明）
- 验证：完整 bun test 2191 通过 / 0 失败；cli-milestone-management、mcp-milestones、milestone-timestamps（文档往返 + updated_date 刷新）、web-milestone-timestamps 均有新增覆盖

## 验收标准

- 里程碑文件可往返文档列表；文档变更通过实质性变更检测刷新 updated_date
- milestone add 接受可重复的 --doc；空值像任务创建一样被拒绝
- milestone edit 支持 --doc/--add-doc/--remove-doc/--clear-docs，语义与任务编辑一致并互斥
- MCP milestone_add/milestone_edit 暴露 documentation/addDocumentation/removeDocumentation
- 指南记录新里程碑选项；task-creation.md 补上缺失的 --add-doc/--clear-docs/--remove-doc 说明
- Web UI 显示并编辑里程碑文档，4 种语言均带 i18n 并转发 API

## Related Concepts

- [[concepts/milestones]] — 里程碑与任务的字段一致性（CLI/MCP/Web）
- [[concepts/mcp-workflow]] — handlers 层共享使 CLI/MCP/Web API 一致性只需一次实现

## Related Sources

- [[sources/back-618-milestone-created-updated-dates]] — 紧邻的前一个里程碑字段任务，本任务复用其展开/投影架构
