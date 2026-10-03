---
title: doc-22 - v1.52.0 至 v1.53.0 上游任务迁移分析报告（按领域）
labels:
  - source
  - migration
  - cli
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:10'
source_path: backlog/docs/migration/doc-22 - v1.52.0-至-v1.53.0-上游任务迁移分析报告（按领域）.md
---

# doc-22 v1.52.0 至 v1.53.0 上游任务迁移分析报告（按领域）

doc-21 全部条目的逐条深度分析（按领域分组），所有结论以**上游 merge commit 与 fork 工作树的 file:line 对照**为依据，分析前提以 `references/current-branch-migration-exclusions.md` 的"不应回退内容"排除。

**CLI-1（BACK-687 列表分页窗口，B 类）**：新增 `list-window.ts` 可近乎原样引入，重写的是接线——fork `src/cli.ts` 比上游多 661 行，七个命令落点逐个重建；`parsePositiveIntegerOption` 要处理从 fork 私有函数到上游新模块的搬迁关系；fork 自研 `memo list` 的 cursor 分页按分层并存接入。补充盘点发现 fork 不是"只有 task 有问题"：7 个对等命令里 3 个 `--limit` 静默截断 + 4 个完全无分页，另有 `memo list`/`config list`/`sequence list`/`wiki` 四条 fork 独有命令上游未覆盖。输出语义核对澄清三条易误解事实：`--limit` 保持静默截断未修、`--count` 打印的是截断后数量、窗口选项强制文本输出且 `--count` 与 `--json` 互斥。

**SRV-1（BACK-688 watcher 随启动方退出，A 类）**：launcher 注入 `BACKLOG_LAUNCHER` env，1 秒对账 tick 上以 ppid 变化/`kill(pid,0)` ESRCH 判定启动方已死即 exit 143 强退。fork 四个接入点逐个核对在位且逐字节一致，且 fork 已有 Windows 安全收流脚手架（`Promise.race` collect），比上游更适合承接新 SIGKILL 用例。

**SRV-2（BACK-689 空闲 watcher 降 CPU，A 类）**：`filesSignature` 对一级路径取名字+size+mtime+ctime 签名，变了才触发读。须采用"只 stat 一级、不递归"的终态版本（首版递归实现会在符号链接循环里永不返回）；**强依赖 SRV-1**（同一行 setInterval 的第二次改写）；本仓 1379 个 md 是上游基线（645）的两倍多，收益放大。

**实施决策记录（CLI-1）四条**：D1 `memo list` 最终改用 `--skip` 取代 `--cursor`（与上游 task list 同构，cursor 保留给 MCP/server API）；D2/D3 作废——`-m` 短称与 `board -m, --milestones` **全部不动**（用户定案）；D4 `-m` 不分配给 `--max-count`，窗口选项一律长选项（骨架借自 `git log` 而非 grep）。待办行号均为改动前基线快照。

## Related Concepts
- [[concepts/upstream-migration]] — 按领域的迁移分析是 fork 上游跟踪流程的深度分析阶段
- [[concepts/cli-entry]] — CLI-1 的窗口选项与 `-m` 短称占用决策均属 CLI 入口契约
- [[concepts/json-output]] — watch 管线 JSON 输出与 SRV-1/2 的进程生命周期修复

## Related Sources
- [[sources/doc-21-upstream-v1-52-0-to-v1-53-0-migration-diff-classification]] — 本报告的初筛分类与范围口径
- [[sources/doc-13-upstream-v1-50-1-to-v1-52-0-migration-analysis-by-domain]] — 上一轮（v1.50.1..v1.52.0）的按领域深度分析
- [[sources/back-657-task-list-json-watch]] — BACK-686 watch 管线的 fork 侧落地，两条 A 类修复的宿主
