---
title: BACK-764 - TTY 交互式多行 memo 捕获
labels: [source, cli, memos, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-764 - CLI-support-interactive-multi-line-memo-capture-on-a-TTY.md
---

# BACK-764 - TTY 交互式多行 memo 捕获

裸跑 `backlog memo create`（不带 `--content`）在交互式终端上直接退出 1（"No memo content provided."），因为 `readStdinText` 等待 EOF，而 TTY 上没有 EOF 直到用户发信号——守卫不能简单去掉，否则命令看似挂死。但 memo 的意义就是快速捕获，每次都得往参数里塞转义或走管道体验很差。本任务让 TTY 场景直接进入交互式捕获：逐行原样录入，Ctrl+D 结束。

## 目标

TTY 上不带 `--content` 时提示并捕获多行正文；提示写 stderr 不进正文；空输入仍走既有空内容报错且不建文件；`--tags` 照常工作；管道/重定向路径完全不变；Ctrl+C 中止（退出码 130）且不破坏终端状态。

## 实现要点

- 新模块 `src/core/interactive-input.ts`：`captureInteractiveBody(stream, hintStream, {signal})` 原样读取多行；结束条件为 EOF、单独的 Ctrl+D 字符（0x04，唯一在包括 VS Code 集成终端与 Git Bash 在内的所有终端都有效的结束键）、或仅含 Ctrl+Z（0x1A）的行（经典 Windows 控制台不给 EOF，作便利兼容）。
- 结束键选型是实测否决的：`tmp/key-probe.ts` 在真实 Windows 控制台验证 cooked 模式下 Enter 与 Ctrl+Enter 字节完全相同、Ctrl+D 什么都不产生，无法解析区分；只有 raw 模式可行。raw 模式下按键直达程序，但会屏蔽控制台回显，故 helper 自带 `echoTarget`（CLI 传 stdout）自行回显，退格能整删一个代理对；raw 标志与 abort 监听在 finally 中恢复，迭代器 return 不可 await（会对仍开着的 TTY 死锁），之后由 cli.ts 销毁 stdin 让进程退出。
- 更新 `readStdinText` 的 doc 注释（其"调用方必须检查 isTTY"的理由对此调用方不再成立）、memo create 的 help 与 `src/guidelines/cli-instructions/memos.md`。

## 验证

用户真机终端实测输入回显与正常退出；`src/test/stdin-capture.test.ts`（假流驱动 helper：多行、空输入、AbortSignal 中止、提示落到 hint 流）与 `src/test/cli-memo-stdin.test.ts`（管道不变、tags+管道正文、空管道拒绝）共 27/27 通过；tsc、biome 干净。

## Related Concepts

- [[concepts/memos]] — 快速笔记子系统，交互捕获是极简捕获理念在 TTY 上的补齐

## Related Sources

- [[sources/back-730-cli-memo-subcommand]] — CLI memo 子命令本体
- [[sources/back-763-memo-update-tags]] — 同线任务，交互捕获需与 `--tags` 兼容
- [[sources/back-525-update-wiki-skill-and-cli-multi-line-input-docs]] — CLI 多行输入文档的既有脉络
