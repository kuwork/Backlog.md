---
title: BACK-717 - Reorder the settings page: state machine card above Workflow Settings
labels:
  - source
  - web-ui
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:14'
source_path: backlog/tasks/back-717 - Reorder-the-settings-page-state-machine-card-above-Workflow-Settings-and-Hide-empty-columns-under-the-terminal-status.md
---

# BACK-717 - Reorder the settings page: state machine card above Workflow Settings and Hide empty columns under the terminal status

本任务对 Web 设置页（src/web/components/Settings.tsx）做纯 JSX 位置调整，把状态相关设置聚到一起，使页面自上而下阅读。实施中纠正了任务初稿的一处错误：Hide empty columns 开关实际位于 Web UI Settings 卡（autoPort/autoOpenBrowser 之后），而非 Workflow Settings 卡。

两处移动：一是把状态机卡片（含 StateMachineEditor）从页尾移到 Workflow Settings 卡片正上方，最终卡片顺序为 Project Settings → State Machine → Workflow Settings → Definition of Done Defaults → Web UI Settings → Advanced Settings；二是把 Hide empty columns 开关从 Web UI Settings 卡移入 Workflow Settings 卡，紧接终态选择器（StatusExcludeDropdown，menuId terminal-statuses-menu）之后、defaultAssignee 之前。

变更严格限定为两个 JSX 块的搬运：绑定（config.hideEmptyColumns 与 handleInputChange、handleTerminalStatusesChange）、类名、标题与 i18n key 全部原样保留，四个 locale 文件未动。由于 .tsx 不受 biome 覆盖且无组件测试，用锚点+缩进校验的脚本（tmp/move-settings-blocks.py，锚点唯一性断言、失败即不写文件）实施，并以 tsc --noEmit、对称 diff（34 增 34 减、单文件）和从源码回读卡片/条目顺序来验证，scoped 测试 web-state-machine-editor.test.tsx 10 通过。

## Related Concepts
- [[concepts/web-ui-features]] — 设置页卡片布局与看板显示开关属于 Web UI 功能体系
- [[concepts/state-machine]] — 被移动的状态机卡片所属的状态机语义概念

## Related Sources
- [[sources/back-715-state-machine-editor-settings]] — 被移动的状态机卡片与终态选择器由该任务引入
- [[sources/back-590-hide-empty-board-columns]] — Hide empty columns 开关功能的同源任务
