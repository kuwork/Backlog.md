---
title: doc-17 - 状态机语义诊断与引擎选型
labels: [source, design, mcp, state-machine]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/docs/PRDS/state-machine/doc-17 - 状态机语义缺失与-AI-协同：完整诊断、方案与引擎选型.md
---

# doc-17 - 状态机语义诊断与引擎选型

本文是状态机相关 PRD 的**唯一事实源**，由 `state-machine-ai-collaboration-report.html` 全文转换而来。核心诊断：Backlog.md 的 `statuses` 只是显示层的列定义而非语义层的状态机——终态靠"数组最后一个元素"、进行中靠硬编码字符串 `"inprogress"` 推断，任何自定义状态列都会让这两条约定**静默失效**（不报错、不警告）。结论：需要"校验器 + 解释器"而非"执行引擎"，自研约 150 行零依赖（`src/core/state-machine.ts`）即可覆盖。

## 问题

以"科研课题管理"七列配置为实证，文章推演出四条故障链：结题课题因终态被误判为"未通过"而无法 `task_complete`；`actualStart` 永不自动填充、`actualEnd` 只在判否时填；结题成果被挤进 `archive/`（无效任务通道）；否决课题反而推进里程碑进度。现有五个机制（MCP 枚举、onStatusChange、workflow 资源、AGENTS.md 注入、definition_of_done）全是"属性级"的，表达不了"状态之间的转换关系"。

## 解决方案

文章横向对比 Jira / Beads / spec-kit / OpenSpec / BMAD / Beans 等八款产品的 AI 协同范式（门禁式/托管式/角色式/记忆式），提出关键洞察"命令即门禁"：把阶段推进从 AI 工具集里拿走交还人类命令。方案分三档：A（零代码，重排 statuses + 状态契约文档 + 指令强制）、B（把 `statuses` 升级为状态机对象：`category` 六类 `initial/active/wip/blocked/done/dropped`、`next` 转换数组挂 `when/requires/ai/evidence`、四档 AI 权限 `allowed/allowed_if/propose/forbidden`）、C（MCP 层下发 `backlog://workflow/state-machine` + `task_edit` 四层校验 + 教学式报错）。

引擎选型结论：要的是"校验器 + 解释器"而非"执行引擎"——现成引擎（XState 等）只覆盖需求的前 30%（A–C），而"列出出边条件权限"（E）与"教学式报错"（F）没有任何引擎提供，**自研约 150 行零依赖**（`src/core/state-machine.ts`），条件求值用声明式子集而非表达式引擎。

## Related Concepts

- [[concepts/task-lifecycle]] — 状态类别（done/dropped 双终态）直接重塑任务的完成/归档语义
- [[concepts/mcp-workflow]] — 方案 C 新增 `backlog://workflow/state-machine` 动态资源下发状态机
- [[concepts/core-architecture]] — 引用的源码事实（terminal-status.ts / backlog.ts / handlers.ts）均属核心层
- [[concepts/state-machine]] — 本文诊断并给出方案的对象形式状态机语义（六类 category、ai 四层权限、转换挂边）

## Related Sources

- [[sources/doc-18-differentiation-gap-analysis]] — doc-18 GAP 2（状态列无语义）的全景定位，本文是该缺口的展开规格
- [[sources/doc-19-default-state-machine-prd]] — 依据本文第 9/12/13 章落地的默认七列状态机 PRD
