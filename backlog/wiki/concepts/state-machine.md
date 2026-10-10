---
title: 状态机语义
labels: [concept, state-machine, config]
created_date: 2026-10-03 01:13
updated_date: 2026-10-09 23:30
---

# 状态机语义

Backlog.md 的 `statuses` 配置从"显示层列定义"升级为带语义的**状态机**：状态有类别、转换边挂条件与 AI 权限，并生成 AI 可读的机器指引。核心诊断是旧约定（终态=数组最后一个元素、进行中=硬编码字符串 inprogress）在自定义状态列下静默失效（[[sources/doc-17-state-machine-semantics-diagnosis]]）。

## statuses 对象形式

配置从字符串数组升级为对象数组，每个状态含：

| 字段 | 说明 |
|---|---|
| `name` | 状态名 |
| `category` | 六类之一：`initial` / `active` / `wip` / `blocked` / `done` / `dropped` |
| `exit` | 离开该状态时的动作（如 archive） |
| `display` | 是否为看板显示列（Dropped 为 display:false 留档） |
| `next[]` | 转换边数组，每条边可挂 `when` / `requires` / `evidence` / `ai` / `if` |

- **转换挂边设计**：语义表达在"状态之间的转换关系"上，而非孤立的属性级机制；每条出边声明条件与所需证据。
- **ai 四层权限**：`allowed`（AI 可直接推进）/ `allowed_if`（满足显式条件如用户批准）/ `propose`（只能建议）/ `forbidden`（禁止，出现即"停下等人工"清单）。
- **legacy 兼容**：旧式字符串数组仍被接受——末位归一化为终态、含 inprogress 的归一化为 wip，渲染时标注"未声明迁移"（[[sources/doc-17-state-machine-semantics-diagnosis]]、[[sources/back-716-state-machine-guidance-overviews]]）。
- 编译器 `src/core/state-machine.ts` 约 150 行零依赖——选型结论是"校验器 + 解释器"而非执行引擎，现成引擎覆盖不了"列出出边条件权限"与"教学式报错"（[[sources/doc-17-state-machine-semantics-diagnosis]]）。

## 默认七列状态机

内置默认承载两个人类审查点（[[sources/doc-19-default-state-machine-prd]]）：

```
To Do → Planning → Plan Review → In Progress → In Review → Done
   └──────────────────→ Dropped（留档终态）
```

- 两个门禁（审 Plan、审 Result）用 `blocked` 类别落位：不按陈旧度回收、不计入 actionable。
- **M1 定位：状态机是说明书不是闸门**——代码只声明、只提示，越界推进不报错；但解析并渲染全部字段。
- `Dropped` 是"留档"终态：不推进里程碑、**不自动归档**（archive 是软删除、ID 可复用，与留档冲突）；彻底清除走 To Do 显式归档。
- `ready` 语义不动，新增 `isActionable`（ready 且未被认领，category ∈ active/initial）。
- `backlog config reset statuses` 可整体重置回默认；`init` 首次初始化直接写入七列对象形式（[[sources/back-715-state-machine-editor-settings]]）。

## 编辑与指引交付

- **设置页状态机编辑器**：左右布局，左侧状态卡片与迁移边表单，右侧以 initialStatus 为根、沿 next 递归展开的 Mermaid 实时预览树（回边降级为虚线回引）。Reset（丢弃未保存改动）与 Default（载入七列默认）语义严格区分；只声明不强制，可展示 lint 警告但不阻止保存（[[sources/back-715-state-machine-editor-settings]]）。保存走 PUT/POST `/api/config/statuses` 并广播 `config-updated`。
- **AI 指引**：`StateMachine.describe()` 从配置只读渲染本项目的机器（状态/类别/exit 表、ai 层级、每状态 next 边、终态表、"停下等人工"清单），经 `{{STATE_MACHINE}}` 占位符注入三份 overview 文本，并经 `state-machine` marker 幂等注入 AGENTS.md/CLAUDE.md（[[sources/back-716-state-machine-guidance-overviews]]）。
- **四语言本地化**：默认状态机做成 en / zh-CN / zh-TW / ja 变体（`defaultStateMachineForLocale()` 经 LC_ALL/LANG 或 Windows 上 Intl 检测），仅本地化 when/if/requires/evidence 散文，状态名与分类不变；Plan Review→In Progress 与 In Review→Done 两条边为 `allowed_if`，默认机器无 forbidden 边（[[sources/back-721-state-machine-localization-guidance]]）。
- 设置页卡片顺序与"Hide empty columns"开关位置见 [[sources/back-717-settings-page-reorder]]；差异化定位（GAP 2 状态列无语义是五缺口之一）见 [[sources/doc-18-differentiation-gap-analysis]]。

## 与任务生命周期的关系

状态机**定义**任务生命周期语义（见 [[concepts/task-lifecycle]]）：category 取代位置约定推导终态（done/dropped 双终态）、wip、actionable；CLI/MCP 的终态判定从 `statusNames()` 末位约定改为按 category 判断。task-execution 指南要求"跟随本项目状态机而非固定序列"，finalization 要求写"机器声明的终态"而非硬编码 Done。M2 预留 `task_edit` 四层校验、MCP 动态资源与教学式报错。

## 终态集的显式化与只读化（BACK-762）

终态集（category 为 done/dropped 的状态）在所有读取路径显式呈现、且只在状态机编辑器可改：

- `backlog config list` 打印 `terminalStatuses: [Done, Dropped] (derived from statuses)` 派生行
- `GET /api/config` 以 spread 附带 `terminalStatuses`（不挂 config 对象上，防 `handleUpdateConfig` 把它写回 config.yml）；`GET /api/statuses` 返回 `{ statuses, terminalStatuses, defaultStatus }`，前端兼容新旧两种形状
- 设置页终态多选删除、换只读区块；`serializeConfig` 只写认识的键，测试把 API 返回体 POST 回去证明派生值不落盘
- 判定 API 分层：`isTerminalStatus(status, rawStatusesConfig)` 吃原始配置自行推导；`isTerminalStatusName(status, resolvedNames)` 吃已解析集合纯比较（BACK-761 的二次推导 bug 促成了这一分层）

## Related Concepts

- [[concepts/task-lifecycle]] — 状态机定义任务生命周期：双终态、actionable、完成/归档语义
- [[concepts/embedded-skills]] — 机器指引经 agent-instructions marker 注入 AGENTS.md/CLAUDE.md
- [[concepts/mcp-workflow]] — overview 资源与 get_backlog_instructions 是机器指引的交付表面
- [[concepts/cli-instructions]] — CLI overview 中的静态章节与 {{STATE_MACHINE}} 占位符
- [[concepts/web-ui-features]] — 设置页编辑器与看板 display:false 隐藏列

## Related Sources

- [[sources/doc-17-state-machine-semantics-diagnosis]] — 语义缺失诊断、六类模型与引擎选型
- [[sources/doc-18-differentiation-gap-analysis]] — GAP 2 定位与 P0 状态类别注解建议
- [[sources/doc-19-default-state-machine-prd]] — 默认七列状态机 PRD
- [[sources/back-715-state-machine-editor-settings]] — 设置页编辑器与 state-machine.ts 编译器
- [[sources/back-716-state-machine-guidance-overviews]] — 静态章节 + describe() 动态注入
- [[sources/back-717-settings-page-reorder]] — 设置页卡片顺序调整
- [[sources/back-721-state-machine-localization-guidance]] — 四语言变体与可读性优化
- [[sources/back-761-terminal-card-actual-end]] — 终态判定 API 分层（isTerminalStatus vs isTerminalStatusName）
- [[sources/back-762-terminal-statuses-readonly]] — 终态集读取路径显式化与设置页只读化
