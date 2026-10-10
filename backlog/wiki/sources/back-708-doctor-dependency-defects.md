---
title: BACK-708 - backlog doctor 报告依赖缺陷
labels: [source, dependencies, cli]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-708 - Report-dependency-defects-cycles-dangling-and-ambiguous-references-from-backlog-doctor.md
---

# BACK-708 - backlog doctor 报告依赖缺陷

`backlog doctor` 现在报告只有全语料视角才能看到的依赖缺陷——环、悬空引用、draft 目标、已释放（仅 archive）的 id 和歧义引用——全部作为警告：运行仍以 0 退出。

## 实现要点

- 五类缺陷各设一节，沿用 `printDraftIdentityReport` 的形态：环带 id 顺序（含自环）、悬空按引用任务列出、draft 目标按禁止方向措辞、已释放 id 附重绑定警告、歧义的交叉引用到重复 ID 一节
- 填补真实空白：readiness 一次只答一个任务且跳过终态任务（已完成任务上的悬空引用无人能看见）；BACK-707 之后写入门卫容忍存量缺陷——doctor 现在是它们唯一出现的语料级场所
- 与 draft 标识报告在退出码上刻意分歧：诊断命令不应把持续的语料状态当作失败——本仓库带着 78 处旧拼写，若每次运行都失败会让 doctor 无用；有修复路径的发现（重复）或配置故障保留各自退出码
- 只诊断不修复：环没有可切的规范边、悬空引用没有目标，因此 `--fix` 只修复重复；该节在每个诊断路径（含 `--fix`）都打印，但不出现在 `--commit`/`--rollback`；只诊断的说明被泛化而非逐字复用
- 实现：分类在 `src/utils/dependency-defects.ts`，基于共享的 `dependency-closure.ts` 语料遍历（与写入门卫同一个，doctor 与门卫不会漂移）；按构造离线——doctor 是一次性 CLI 命令，报告必须在无服务端运行时正确
- 干净路径的提前返回（`plan.groups.length === 0 && !draftIdentityBroken`）加入了依赖信号，只有缺陷的语料也会打印；help schema 已更新（reads 承认 drafts/milestones/archive；writes 仍只描述重复修复）
- 本仓库实测：78 处悬空（5 处在 draft 上），其余各类为 0，退出 0；cli-doctor.test.ts 覆盖所有类别及两种 `--fix` 交互形态

## 验收标准

- 环、悬空、draft 目标、已释放 id 和歧义引用各作为警告报告；退出保持 0
- 干净语料仍打印 "No duplicate task IDs found."；无内容可报时该节缺席
- `--fix` 绝不触碰依赖列表；重复修复流程、`--commit`/`--rollback` 与其他退出码不变
- 与写入门卫相同的语料索引（tasks + completed），不依赖 graph service

## Related Concepts

- [[concepts/cli-entry]] — doctor 命令面与 help schema
- [[concepts/task-identity]] — 报告交叉引用的重复/歧义 id 语义

## Related Sources

- [[sources/back-707-dependency-gate-cycles]] — 本报告使其存量缺陷可见的写入门卫（同一批）
- [[sources/back-709-dependency-closure-query]] — 共享 `dependency-closure.ts` 遍历（同一批）
- [[sources/back-538-duplicate-task-id-recovery]] — doctor 已有的重复 ID 修复流程
