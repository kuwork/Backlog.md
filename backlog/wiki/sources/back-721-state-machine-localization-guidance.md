---
title: BACK-721 - 状态机引导本地化与可读性优化
labels: [source, state-machine, guidelines, i18n]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-721 - Optimize-State-Machine-Guidance.md
---

# BACK-721 - 状态机引导本地化与可读性优化

默认任务状态机及其引导文案存在两个痛点：agent 阅读机器规则的速度慢（渲染出的机器块约 80 行，充斥着冗余 requires 和长句），且机器文案只有英文，非英文项目拿到的引导与界面语言不一致。

## 实现要点

方案是把默认状态机做成按语言变体的形式：en、zh-CN、zh-TW、ja 四个变体放在既有的 locale 文件（`src/web/locales/*.ts` 导出 `defaultStateMachine`），仅本地化 when/if/requires/evidence 散文，状态名与分类保持不变。语言检测新增 `defaultStateMachineForLocale()`：读取 LC_ALL/LC_MESSAGES/LANG 环境变量，在 Windows（无这些环境变量）上经 `Intl` 回退到操作系统区域，未知语言回退英文；`init` 把检测到的值同时写入 config 的 locale 与 statuses variant，保证界面语言与机器语言永不分离。

规则语义也做了调整：计划批准（Plan Review -> In Progress）与最终验收（In Review -> Done）两条边改为 `ai: allowed_if` 并带显式的用户批准条件，默认机器中没有任何边是 forbidden；To Do -> Dropped 保持 propose，但 when 文案提示用户移入 Dropped 即归档（exit: archive）。文案措辞统一为 "user"（替代 "human"），所有 "Status Machine" 改为 "State Machine"。

渲染器可读性优化：requires 与 if 相同时省略 requires、引言长句拆为两条要点、stop-and-wait 部分改为边的索引、终态表与归档规则合并为一句、无出边的状态折叠为一行，机器块从约 80 行降到约 55 行。Web 设置页的状态机编辑器中 Default 按钮不再自动保存，而是把项目配置语言对应的默认变体作为草稿载入编辑器、仅在用户保存时写入。本项目自身的 `backlog/config.yml` 使用 zh-CN 变体。

## 验证

tsc、biome 及 state-machine / init / mcp-server 测试套件全部通过；全量 bun test 的剩余失败均为预存在或负载不稳定（经 stash 基线确认，后续由 BACK-722 处理）。

## Related Concepts

- [[concepts/task-lifecycle]] — 状态机定义任务在 To Do/Plan Review/In Progress/In Review/Done/Dropped 间的生命周期及每条边的 ai 权限
- [[concepts/cli-instructions]] — 机器与引导文案注入到 CLI 指令文件（`src/guidelines/cli-instructions/overview.md`），本任务将其标题与措辞改为 State Machine / user
- [[concepts/mcp-workflow]] — MCP 概览指令（`src/guidelines/mcp/overview.md`）同步了同一套机器措辞

## Related Sources

- [[sources/back-656-agent-guidance-overview-cadence]] — 同属 agent 引导文案的维护任务，涉及指引的注入与更新节奏
