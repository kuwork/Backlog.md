---
title: Stop task list watchers when the process that started them exits
labels:
  - source
  - cli
  - watch
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:14'
source_path: backlog/tasks/back-743 - Stop-task-list-watchers-when-the-process-that-started-them-exits.md
---

# Stop task list watchers when the process that started them exits

问题：`backlog task list --json --watch`（BACK-657）由其他程序读取其 stdout 驱动。当启动方程序未停止 watch 就退出（终端关闭或被 kill），watcher 成为孤儿进程（POSIX 上 reparent 到 PID 1），只有任务变更触发写入已关闭的 stdout 时才退出，安静仓库中会无限运行。watch 的 1s reconcile tick 没有存活性检查；启动方自身无法解决（被杀的进程无法停止子进程；npm 安装时启动的是 Node 启动器 `scripts/cli.cjs`，它转发不了信号也感知不到父进程死亡）。明确排除了 Bun no-orphans：它是进程级的、退出时 SIGKILL 所有后代、Windows 上是空操作、且覆盖不了 Node 启动器。

方案（移植上游 BACK-688 修复，byte-identical）：启动器在 spawn 原生二进制时注入一个内部未文档化的环境变量 `BACKLOG_LAUNCHER=<launcher pid>:<launcher parent pid>`，除 watch 外对所有命令惰性无副作用。watch 在模块加载时（解析与项目查找之前）记录自己的父进程；仅当环境变量第一段等于本进程父进程时，才把启动器的父进程记为第二个启动方——从而忽略通过无关进程继承的过期标记。现有 1s tick 改为 `starterExited() ? onTerminate() : refresh()`：`isRunning(pid)` 用 `process.kill(pid, 0)`、只有 ESRCH 算消失，父进程改变（POSIX reparenting）或任一记录的 pid 消失即判定启动方已退出，走既有 exit-143 强制退出路径。

范围限定为 watch 启动的进程（直接或经启动器）；`backlog browser` 等长驻命令生命周期不变。测试在本代码库适配：复用 Windows 安全的 `collect()`（`Promise.race([drain, until])`）脚手架，断言 stdout 在有界时间内 EOF；新增直接 watch 和经 `node scripts/cli.cjs`（fixture 平台包，二进制为当前 Bun 可执行副本）两个 SIGKILL 用例 + 过期标记用例。平台发现：Bun 给 spawn 的子进程挂 kill-on-close job object，Bun 启动方的整棵树随它死亡、测不出 watch 是否自行退出，因此测试启动方用 `node -e`、Windows 上经 `cmd /c` 断开 job 关联。回归矩阵（临时变异验证）：去掉 guard 两个 SIGKILL 用例超时失败；只去掉启动器 env 行启动器用例失败；去掉 `launcher === parent` 比较过期标记用例变红。

已知限制：经启动器时，启动方退出要等其父 reaping 后才被看到（zombie 上 kill(pid,0) 仍成功）；单 tick 内的 PID 复用会延迟检测；中间的 npx 会成为启动器父进程；Windows 上整树在同一 Bun job object 内的 watch 本就随启动方死亡，本检查只覆盖逃出 job 关联的链。

## Related Concepts
- [[concepts/json-output]] — watch 流复用的 JSON 契约，退出路径不影响字节格式
- [[concepts/cli-instructions]] — watch 新生命周期语义文档化在 task list help、overview.md、CLI-INSTRUCTIONS.md
- [[concepts/json-watch]] — watch 生命周期契约概念，本任务的 starter 存活性 guard 是其一环

## Related Sources
- [[sources/back-657-task-list-json-watch]] — 前置任务：--watch 本身的能力与退出边界设计，本任务补上启动方存活性 guard
- [[sources/back-744-watch-idle-cpu-signature]] — 后续任务：同一 tick 上叠加 stat 签名检查，消除空转 CPU
