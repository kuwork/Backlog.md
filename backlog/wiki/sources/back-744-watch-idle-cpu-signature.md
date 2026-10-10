---
title: BACK-744 - watch 空转 CPU 的 stat 签名治理
labels: [source, cli, watch]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-744 - Keep-idle-task-list-watchers-from-using-constant-CPU.md
---

# BACK-744 - watch 空转 CPU 的 stat 签名治理

## 问题

`backlog task list --json --watch` 常驻运行且常有多实例。无事发生时本应空转，但 1s reconcile tick 无条件执行完整读取（新建 Core、重复 ID 扫描、任务查询、completed 语料就绪检查、JSON 序列化），成本随仓库增长：macOS 上 645 个 backlog 条目的仓库实测空转稳定占用 35-42% CPU；本仓库约 1379 个 markdown 文件，更严重。文件系统通知不是原因（10s 空转 0 事件），browser/TUI 走 ContentStore watcher 不受影响。

## 解决方案

方案（移植上游 BACK-689 修复，`watch-json.ts` 与测试与参考修复 byte-identical）：保留 1s reconcile 保证（漏掉的通知约 1s 内被修复），但把每秒检查变廉价——比较"规范读取输入"的 stat 签名（条目名 + size + mtimeMs + ctimeMs，仅一层深，跟随符号链接如 loaders；缺失、悬空或成环条目只按名字计数），与上次读取前取的签名比较，不同才重新读取。签名在每次读取前取，读取期间发生的变化会调度下一轮。通知仍直接触发读取，因此过滤、scope、JSON 字节与更新延迟全部不变。tick 先查 BACK-743 的 starter 存活性，被杀的启动方仍会结束 watch。

只统计一层的理由：初版递归遍历 `backlog/`，而递归 `readdirSync` 跟随目录符号链接且无环检查——一个 symlink 环每次 pass 花 ~21-25ms，两个环永不结束，`Bun.Glob` 的 followSymlinks 在 pinned Bun 1.3.14 下也走到链接限制。`src/cli.ts` 调用点按本代码库适配：inputs 由 FileSystem getters（tasksDir、completedDir、milestonesDir、archiveMilestonesDir、configFilePath）构建，即使不带 `--milestone` 也始终包含 milestones（文件少且未变化输出会被抑制）；通知 scope（递归 `backlog/` + 配置目录）不变，后建目录仍可见。

## 验证

测量（macOS，645 条目，60s 空转采样，双二进制并排）：修复前 21.47s CPU（35.8%），修复后 0.41s（0.68%）；外部编辑期间两版本输出逐字节一致。本机未复现测量。剩余空转成本是 1s 一次的 stat pass 本身。测试：原"仅内存状态变化"的 reconcile 测试只在每秒重读时才能通过，替换为 2.5s 内不得重复读取的空转用例（旧 timer 上以 3 次读取失败）+ `filesSignature` 覆盖（保 mtime 的同尺寸编辑由 ctime 捕获、创建、删除、非递归 scope、junction 目录链接——Windows 可跑；文件符号链接用例 Windows 跳过）。验证：watch 相关套件 17 pass / 1 skip / 0 fail。

## Related Concepts
- [[concepts/json-output]] — watch 流字节契约不变，只改变何时重新读取
- [[concepts/cli-instructions]] — watch 行为说明未变，改动在实现层
- [[concepts/json-watch]] — watch 生命周期契约概念，本任务的空转 stat 签名检查是其一环

## Related Sources
- [[sources/back-657-task-list-json-watch]] — 前置任务：--watch 的 reconcile 设计，本任务把每秒全量读取降为签名比较
- [[sources/back-743-watch-starter-liveness]] — 前置任务：同一 tick 上的 starter 存活性 guard，本任务的签名检查排在其后
