---
title: BACK-618 - 里程碑新增创建与更新日期字段
labels: [source, milestones, cli, mcp, web-ui]
created_date: 2026-09-07 18:54
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-618 - Add-created_date-and-updated_date-fields-to-milestones.md
---

# BACK-618 - 里程碑新增创建与更新日期字段

里程碑缺少任务自早期版本就有的创建/更新元数据。本任务镜像任务字段设计：`created_date` 在创建时自动盖戳，`updated_date` 仅通过 BACK-534 集中式投影在实质性变更时刷新（纯排序变更保留原值），UTC 存储格式经 `parseStoredUtcDate` 读取，全部字段搭 `{...milestone}` 展开的便车因此未改任何函数签名——随后三个并行子代理落地了 CLI、MCP 和 Web 三个面。

## 实现要点

- Core：`Milestone` 类型新增 `createdDate?/updatedDate?`；`parseMilestone`/`serializeMilestone` 条件性往返这两个字段（无字段的旧文件保持干净，无空字符串污染）；`fs.createMilestone` 盖 created_date（UTC `YYYY-MM-DD HH:MM`）并返回 `parseMilestone(content)`（修复其手工构建的返回对象丢字段的问题）；`fs.updateMilestone` 通过排除时间戳自身的可比投影，仅在实质性变更时集中盖 updated_date
- CLI：`milestone list` 追加 '(updated ...)' 或 '(created ...)'（updatedDate ?? createdDate），两者皆缺省时省略
- MCP：`milestone_list` 行追加 '(Created: ..., Updated: ...)'，仅为存在的字段加标签
- Web：里程碑卡片 'Milestone dates' 行在计划日期左侧显示 'Last Updated'（最近更新）（仅 updatedDate || createdDate 时可见，优先 updatedDate）；MilestoneDetailsModal 在侧边栏顶部以紧凑信息框显示 创建于/更新于，标记与类同任务编辑页一致；新增 `taskDetails.section.lastUpdated` i18n 键于 en/zh-CN/zh-TW/ja
- Docs：BACK-521 回移植模式——行为同步进 `src/guidelines/cli-instructions/milestones.md`、`src/guidelines/mcp/milestones.md` 和 `src/guidelines/agent-guidelines.md`
- 测试：`milestone-timestamps.test.ts`（5）、cli-milestone-management（16）、mcp-milestones（34）、`web-milestone-timestamps.test.tsx`（6）+ 14 项回归，指南测试 28/28

## 验收标准

- created_date 在里程碑创建时自动写入（UTC 存储，与任务一致）
- updated_date 仅在实质性变更时刷新；排序变更不刷新
- 所有日期读取使用 parseStoredUtcDate 并跨时区正确渲染
- 无字段的旧里程碑文件不报错；显示回退到 created_date
- 字段在 CLI、Web UI、MCP 各面可见/可获取
- Web 里程碑页在 planned start 左侧显示 'Last Updated'；编辑页在右上角显示两个日期，样式与任务编辑页一致

## Related Concepts

- [[concepts/milestones]] — 里程碑模型、frontmatter 字段与各面一致性
- [[concepts/date-fields]] — UTC 存储格式、parseStoredUtcDate 与 BACK-534 实质性变更投影

## Related Sources

- [[sources/milestone-actual-dates-task]] — BACK-493 actualStart/actualEnd 推广，本任务遵循的先例
