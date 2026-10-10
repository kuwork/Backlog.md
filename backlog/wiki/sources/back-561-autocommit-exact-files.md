---
title: BACK-561 - autoCommit 精确暂存写入文件
labels: [source, git, auto-commit, core]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-561 - Scope-autoCommit-to-exactly-the-files-each-write-touches.md
---

# BACK-561 - autoCommit 精确暂存写入文件

autoCommit 现在只暂存每次写入实际触碰的文件（新文件加上被替换/移动的旧路径），不再暂存整个 backlog 目录，也不再清空共享 git index。

## 实现要点

- `src/file-system/operations.ts`：`archiveDraft` 返回 `{ sourcePath, targetPath }`；`demoteTask` 和 `promoteDraft` 接受 `onMoved` 回调；`saveDecision`/`saveDocument` 返回被移除的文件路径。
- `src/git/operations.ts`：新增 `addFiles` 循环；`commitTaskChange` 委托给 `commitFiles`；`commitFiles` 拆分多仓路径集合，并针对 `git diff --name-only -z --cached --no-renames` 得到的已暂存路径用 `--only` 提交；移除 `resetIndex`/`commitStagedChanges`；`stageFileMove` 对旧路径用 `git rm --cached`。
- `src/core/backlog.ts`：`updateTask` 返回写入的文件路径；`updateTasksBulk` 收集路径并提交；archive/complete 同时提交移动两侧；任务、草稿、决策、文档和 agent 指令的创建/更新统一走新的 `commitWrittenFile` helper。
- `src/core/content-store.ts`：更新 `saveDocument`/`saveDecision` 的 patch 签名。
- `src/agent-instructions.ts`：通过 `commitFiles(paths)` 提交触碰的指令文件。
- 后续修复：为 `updateDecision` 和 `createDocument` 补上提交信息参数，使更新以 `Update decision/document` 提交。

Fork 适配：未移植上游的临时索引 CAS 流水线；`git commit --only` 语义足以在保留用户暂存的同时精确提交路径。放弃了上游遗留路径的批量场景，因为本 fork 会根据文件名校验任务 ID。

## Related Concepts

- [[concepts/core-architecture]] — Core、FileSystem 与 Git 集成
- [[concepts/cli-entry]] — 触发 autoCommit 的 CLI 命令

## Related Sources

- [[sources/back-538-duplicate-task-id-recovery]] — Doctor 重复 ID 恢复
