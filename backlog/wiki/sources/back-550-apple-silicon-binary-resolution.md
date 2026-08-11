---
title: BACK-550 Apple Silicon 二进制解析改进
labels: [source, cli, launcher, bug]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-550 - Improve-binary-resolution-on-Apple-Silicon-Rosetta-arch-mismatch.md
---

# BACK-550 改进 Apple Silicon 二进制解析（Rosetta/架构不匹配）

修复 M1/M2 Mac 上通过 Rosetta(x64) 运行 Node/Bun 时的二进制解析错误。

## 问题

在 M1/M2 Mac 上用户可能通过 Rosetta(x64) 运行 Node/Bun 而 OS/CPU 为 arm64，导致启动器解析到错误平台包或只安装一个变体，报 `illegal hardware instruction` 或 `Binary package not installed`。

## 根因

启动器在 darwin 上只解析单一架构包，且使用了 `@kuwork` 前缀的 scoped 平台包名——而这些 scoped 包从未发布（既有 bug）。

## 解决方案

- `scripts/resolveBinary.cjs`：构建有序候选包名列表（原生 darwin 架构优先，arm64<->x64 兄弟架构为回退；linux/win32 或未知架构无回退），用 `sysctl -in sysctl.proc_translated` 检测 Rosetta，`resolveBinaryPath` 支持可注入 resolver 便于测试
- 平台包名改用 fork 发布的非前缀形式 `backlog.md-<platform>-<arch>`（`@kuwork` scope 仅用于主包），修复 scoped 名查找 bug
- `scripts/cli.cjs`：将同步 spawn 异常与 error 事件统一经 `isBinaryInstallError` 分类（errno -86/EBADARCH/ENOEXEC/ENOENT），输出检测到的平台架构、Node 版本、Rosetta 状态、已尝试包及具体重装命令；子进程死于信号（SIGILL/SIGTRAP）时退出码改为 1
- README 新增 Apple Silicon 故障排查章节（brew/npm/bun 原生架构重装命令）

## 实现位置

- `scripts/resolveBinary.cjs`、`scripts/cli.cjs`、`README.md`
- `src/test/resolveBinary.test.ts`、`src/test/cli-launcher.test.ts`

## 测试

resolveBinary.test.ts（darwin 双向回退矩阵、linux/win32 无回退、.exe 后缀、双缺失错误、非 darwin 短路）、cli-launcher.test.ts（缺包引导+退出 1、参数/退出码透传、SIGILL 引导、SIGTERM 退出 143、ENOEXEC）。

## Related Concepts
- [[concepts/cli-entry]] — 启动器解析
- [[entities/backlog-cli]] — 平台包分发

## Related Sources
- [[sources/back-539-linux-runner-win32-arm64-build]] — 平台二进制构建
