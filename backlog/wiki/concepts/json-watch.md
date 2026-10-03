---
title: task list --watch 生命周期契约
labels:
  - concept
  - cli
  - watch
created_date: '2026-10-03 01:13'
updated_date: '2026-10-03 01:13'
---

# task list --watch 生命周期契约

`backlog task list --json --watch` 由其他程序读取其 stdout 驱动，是一条**JSON 行流能力**：输出与一次性 `--json` 逐字节相同的完整替换帧（无事件包装、游标或单变更事件），初帧即完整列表，变更后发出全量替换，未变化的字节被抑制（[[sources/back-657-task-list-json-watch]]）。本概念页覆盖该 watch 进程的生命周期：能力契约、启动方存活性、空转成本控制。

## 流契约

- 每次读取经与一次性命令相同的 action 重新解析 options、过滤、排序、limit、`--ready` 与 local-only scope，保证重复读取与 one-shot 不漂移。
- 空结果也发出空 `tasks` 数组信封——订阅方绝不能被留在没有替换列表的状态。
- 目录通知挂在首次读取之前，周期性 reconcile 兜底漏掉的通知；SIGINT/SIGTERM、管道关闭、慢读者、读取失败均有界关闭（SIGTERM 退 143）。
- 首次响应后发现重复任务身份 → JSON 读取 fail-closed（stderr 点名冲突文件，exit 1）。

## 启动方存活性检测（BACK-743）

问题：启动方程序未停止 watch 就退出时，watcher 成为孤儿进程，安静仓库中无限运行；且 npm 安装时启动方是 Node 启动器 `scripts/cli.cjs`，转发不了信号（[[sources/back-743-watch-starter-liveness]]）。

方案（移植上游 BACK-688，byte-identical）：

- 启动器 spawn 原生二进制时注入未文档化环境变量 `BACKLOG_LAUNCHER=<launcher pid>:<launcher parent pid>`，除 watch 外所有命令惰性无副作用。
- watch 在模块加载时（解析与项目查找之前）记录自己的父进程；仅当 env 第一段等于本进程父进程时，才把启动器的父进程记为第二个启动方——忽略无关进程继承的过期标记。
- 1s tick 改为 `starterExited() ? onTerminate() : refresh()`：`isRunning(pid)` 用 `process.kill(pid, 0)`，只有 ESRCH 算消失；父进程改变（POSIX reparenting）或任一记录的 pid 消失即判定启动方已退出，走既有 exit-143 路径。

已知限制：经启动器时启动方退出要等其父 reaping 后才被看到（zombie 上 kill(pid,0) 仍成功）；单 tick 内 PID 复用会延迟检测；Windows 上同一 Bun job object 内的 watch 本就随启动方死亡，本检查只覆盖逃出 job 关联的链。

## 空转 stat 签名（BACK-744）

问题：1s reconcile tick 无条件执行完整读取（新建 Core、重复 ID 扫描、任务查询、completed 语料检查、序列化），空转 CPU 随仓库增长——645 条目仓库实测 35-42%（[[sources/back-744-watch-idle-cpu-signature]]）。

方案（移植上游 BACK-689，byte-identical）：

- 保留 1s reconcile 保证（漏掉的通知约 1s 内被修复），但把每秒检查变廉价：比较"规范读取输入"的 **stat 签名**——条目名 + size + mtimeMs + ctimeMs，仅一层深，跟随符号链接。
- 签名与上次读取前取的比较，不同才重新读取；签名在每次读取前取，读取期间的变化会调度下一轮。通知仍直接触发读取，过滤、scope、JSON 字节与更新延迟全部不变。
- tick 先查 starter 存活性，再查签名——被杀的启动方仍会结束 watch。
- 只统计一层是刻意的：递归 `readdirSync` 跟随目录符号链接且无环检查，symlink 环每次 pass 花 ~21-25ms 甚至永不结束。
- inputs 由 FileSystem getters（tasksDir、completedDir、milestonesDir、archiveMilestonesDir、configFilePath）构建，即使不带 `--milestone` 也始终包含 milestones（文件少且未变化输出会被抑制）。
- 实测（macOS，645 条目，60s）：修复前 35.8% CPU → 修复后 0.68%；外部编辑期间两版本输出逐字节一致。ctime 负责捕获"保 mtime 的同尺寸编辑"。

## Related Concepts

- [[concepts/json-output]] — watch 流逐字节复用的版本化 JSON 契约
- [[concepts/cli-instructions]] — watch 行为在 task list help / overview.md 的文档化位置
- [[concepts/statistics-corpus-scope]] — watch 的 stat 签名输入包含 completedDir，语料 scope 影响重读成本

## Related Sources

- [[sources/back-657-task-list-json-watch]] — --watch 流能力本身与退出边界设计
- [[sources/back-743-watch-starter-liveness]] — BACKLOG_LAUNCHER 注入与启动方存活性 guard
- [[sources/back-744-watch-idle-cpu-signature]] — 空转 stat 签名与 CPU 修复
