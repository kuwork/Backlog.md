---
title: BACK-707 - 依赖校验拒绝环并容忍存量悬空依赖
labels: [source, dependencies, core, cli]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-707 - Refuse-cycles-in-the-shared-validateDependencies-gate-and-tolerate-unresolvable-dependencies-only-where-they-are-already-stored.md
---

# BACK-707 - 依赖校验拒绝环并容忍存量悬空依赖

共享的 `validateDependencies` 写入门卫补齐了它从未有过的两类缺陷——自引用与环——同时学会"容忍历史，不容忍新错"：磁盘上已存量存储的悬空依赖带警告按类型写回，但写入新引入的任何东西仍被拒绝。

## 解决方案

- 动机来自本仓库实测：147 条依赖边中有 78 条（53%）解析不到目标（旧式 `task-NNN` 拼写），其中三条挂在开放任务上，而 BACK-217（`[task-213]`）这类记录根本无法写回——即使重新提交自己的列表也被拒绝，连标题修复都失败
- 新的硬性拒绝：候选解析到主体自身 id，或候选已经能够到达主体——拒绝时把链写进消息（`TASK-1 -> TASK-2 -> TASK-1`）；不变的硬规则：标识歧义、draft 目标、milestone 目标、写入新引入的任何不可解析 ID（所有 create 保持严格——没有存量列表可比）
- 新的软性规则：从存量记录原样 carried over 的不可解析 ID 放行，警告打印在 CLI stderr，并作为数据带入 JSON/MCP 结果；逐候选判断，绝不比较整个列表；仅 archive 的 id 遵循同样的二分（不在池中，可重新绑定）
- draft 移出可解析池，改为资格检查：draft 永远不是合法目标（消除了门卫曾接受一条"readiness 读回为 missing"的边的活分歧），但 draft 仍可依赖任务——保证 promotion 安全
- 环检测走一次 `src/utils/dependency-closure.ts` 的广度优先可达性，与 BACK-709 共享，邻接由门卫已加载的 `known` 数组（tasks + completed）构建——绝不来自 graph service，其快照可能滞后于被判断的写入
- 持久化要点：被容忍的 ID 按记录持有的拼写写回（`task-213` 保持 `task-213`），可解析候选仍被规范化（`358` → `BACK-358`）；carried-over 比较前两侧必须以同样方式规范化，否则容忍逻辑永不触发
- 只有两个编辑分支（列表替换、addDependencies）传递存量列表；create 在门卫之后才分配 id，不会触发环；dependency.test.ts / cli-dependency.test.ts 覆盖充分并带 mutation check

## 验收标准

- 自引用与环（直接或成链）被拒绝并在消息中点名链；磁盘记录不动
- 菱形、共享前驱、已完成任务目标与不变的重新提交仍通过；去掉闭合环的那条边可成功
- draft/milestone 目标被拒绝；不可解析 ID 新引入时被拒绝、按存量拼写 carried over 时放行并给出宿主可见警告
- 检测走门卫自己的语料（tasks + completed），任何宿主都不依赖 graph service

## Related Concepts

- [[concepts/task-identity]] — 门卫依赖的规范化与前缀无关匹配
- [[concepts/task-lifecycle]] — 定义目标池的 draft/completed/archive 状态

## Related Sources

- [[sources/back-708-doctor-dependency-defects]] — 与本写入门卫互补的语料级报告（同一批）
- [[sources/back-709-dependency-closure-query]] — 共享 `dependency-closure.ts` 的读取侧（同一批）
- [[sources/back-615-dependency-readiness-guidance]] — 门卫不得违背的 readiness 语义
- [[sources/back-577-clear-deps-refs-docs-empty-setter-rejection]] — 更早的依赖列表写入语义
