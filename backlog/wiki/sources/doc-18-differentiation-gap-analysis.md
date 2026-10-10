---
title: doc-18 - 差异化管理机制差距分析
labels: [source, design]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/docs/differentiation/doc-18 - 差异化管理机制横向差距分析：七层模型与五个缺口（完整版）.md
---

# doc-18 - 差异化管理机制差距分析

本文由 `differentiation-management-report.html` 全文转换而来，回答"一套工具如何服务软件/科研/采购/写作等迥异项目"。核心判断：Backlog.md 的差异化停留在**配置层**（改列名、DoD、ID 前缀——改的是外观与默认值），而头部产品已下沉到**模型层**（工单类型、状态类别语义——改的是数据模型与执行语义）。

## 问题

分析框架是**七层模型**：L1 类型系统 → L2 状态机 → L3 字段 → L4 规范底座 → L5 角色 → L6 工作流 → L7 沉淀，逐层对 9 款产品（Beads/Beans/TaskMaster/spec-kit/OpenSpec/cc-sdd/BMAD/Jira/Linear/GitHub Issues）打分。Backlog.md 覆盖度 4.0 分，缺口集中在五个结构性位置：GAP 1 无工单类型系统（分类错配给自由文本 labels）、GAP 2 状态列无语义、GAP 3 无工作流模板（指引是文本不是可实例化配方）、GAP 4 规范底座只是"完成卫生"而非行为约束、GAP 5 角色模型缺失（建议"有意识地不做"）。

## 解决方案

建议按 P0/P1/P2 排序：P0 = 状态类别注解（六类，勿照搬 Beads 的队列可见性语义）、受控 labels 词表、项目级 constitution 文件约定；P1 = 按类型/标签分 DoD、工作流配方（`backlog init --recipe`）；P2 = 真正的 type 字段、角色权限模型。同时强调三项别人没有的优势别丢：`--no-git` 非代码模式、计划/实际双层时间字段、五种 Agent 指令文件统一注入。文末给出五类项目（软件/课题评审/采购/写作/AI 实验）的完整配置配方模板。

## Related Concepts

- [[concepts/task-lifecycle]] — GAP 2 与 P0-1（状态类别注解）直接指向任务状态语义
- [[concepts/core-architecture]] — 七层模型逐层盘点的是 core 的配置与数据模型能力
- [[concepts/upstream-migration]] — 横评的 Beads/Beans/spec-kit 等即迁移分析反复参照的上游同类产品
- [[concepts/state-machine]] — GAP 2 / P0-1 状态类别注解落地的状态机语义概念

## Related Sources

- [[sources/doc-17-state-machine-semantics-diagnosis]] — 本文 GAP 2 与 P0-1 的展开规格（点与面的分工）
- [[sources/doc-19-default-state-machine-prd]] — P0 状态类别注解落地的 PRD 成果
