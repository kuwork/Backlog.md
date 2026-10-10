---
title: doc-19 - 默认状态机 PRD（七列三审查点）
labels: [source, specification, state-machine, web-ui]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/docs/PRDS/state-machine/doc-19 - PRD：默认状态机（7-列-·-三审查点落位-·-可重置-·-指引优先）.md
---

# doc-19 - 默认状态机 PRD（七列三审查点）

本文档是 M1 里程碑的 PRD（第 7 版，对应任务 BACK-715），依据 doc-17 第 9/12/13 章，把内建三列默认值细化为**能承载三审查点的七列状态机**：`To Do / Planning / Plan Review / In Progress / In Review / Done / Dropped`。

## 问题

核心病灶是三列压了六个语义位置，两个人类门禁（审 Plan、审 Result）没有落点——"批准后状态不变"是必然结果。

## 解决方案

M1 的定位是**状态机是说明书不是闸门**：代码只声明、只提示，不阻塞不判断（NG8/AC-18：越界推进不报错），但解析并渲染全部字段含 `ai`/`if`/`requires`/`evidence`（第 7 版 D9 修正——声明不需要拦截机制也能生效）。`ready` 语义不动，新增 `isActionable`（可开工 = ready 且未被认领，category ∈ active/initial）。关键设计决策：两个人类门禁用 `blocked` 类别（不按陈旧度回收、不计入 actionable）；`Dropped` 是"留档"终态不推进里程碑且**不自动归档**（archive 是软删除、ID 可复用，与留档目标冲突），彻底清除走 `To Do` 状态显式归档。

功能需求 FR-1~FR-9：`statuses` 对象形式 + `compileStateMachine()` 编译器（约 150 行零依赖）、七列默认、按类别推导取代位置约定、配置 Lint 分级处置、`backlog config reset statuses` 重置、加载兜底、`describe()` 生成 ≤70 行状态机指引并幂等注入 AGENTS.md/CLAUDE.md（新增第三种 marker kind `state-machine`）、设置页状态机可视化编辑栏（左状态表单 + 右树状 Mermaid，FR-9）。M2 预留：`task_edit` 四层校验、MCP 动态资源、教学式报错。

## Related Concepts

- [[concepts/task-lifecycle]] — 七列状态机与双终态（Done/Dropped）直接定义任务生命周期语义
- [[concepts/embedded-skills]] — FR-8 指引经 agent-instructions marker 机制注入 AGENTS.md/CLAUDE.md
- [[concepts/web-ui-features]] — FR-9 设置页状态机编辑栏与看板 7 列宽度（hideEmptyColumns）落在 Web UI
- [[concepts/state-machine]] — 本文 PRD 定义的默认七列状态机语义（三审查点落位、M1 只提示）

## Related Sources

- [[sources/doc-17-state-machine-semantics-diagnosis]] — 本 PRD 的问题定义、六类模型与引擎选型依据
- [[sources/doc-18-differentiation-gap-analysis]] — P0 状态类别注解建议的落地成果
