---
title: BACK-719 - config list 支持 --plain
labels: [source, cli]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-719 - Make-backlog-config-list-accept-the-plain-flag-the-overview-prints.md
---

# BACK-719 - config list 支持 --plain

本任务修复 CLI 指引与实现之间的一处脱节：`backlog instructions overview`（随 BACK-582 加入）把 `backlog config list --plain` 打印为读取实时配置的标准方式，并规定"AI 可读输出一律加 --plain"，但 `config list` 根本没声明任何选项，照做的 agent 直接收到 `error: unknown option '--plain'`。对指引中全部 15 个带 --plain 的命令做审计后确认只有 config list 一个缺口，不是通用 flag 管道问题。

## 解决方案

方案是保留文档命令、给 `config list` 声明 `--plain` 并接受后继续（输出本就已纯文本、无需改变），与 decisions.md:26 记录的 `decision create --plain` 先例一致；被否决的替代方案是从 overview 两行里删掉 --plain，那样指引仍会要求一个仍被拒收的 flag。实现仅动 src/cli.ts 的 `configCmd.command("list")`：`.option("--plain", ...)` + help-schema 可选字段 + 示例，action 回调与输出体不动。

验证：`config list --plain` 退出 0 且与 `config list` 输出逐字节相同；`--help` 列出该 flag；15 个文档命令的 --help 选项集前后 diff 证明只有 config list 变化；config-commands.test.ts 新增测试（20 通过）。范围明确不含新增 --json 或其他输出格式。遗留事项：已安装的全局 CLI 二进制是旧编译产物，仍需重新构建/安装后修复才对直接调用 `backlog` 的 agent 生效。

## Related Concepts

- [[concepts/cli-instructions]] — 脱节源于 CLI overview 文档与实现约定（--plain 惯例）不一致
- [[concepts/json-output]] — AI 可读输出约定（--plain / 结构化输出）的相邻主题

## Related Sources

- [[sources/back-582-agent-first-round-load-config]] — 引入 `config list --plain` 文档行的上游任务
- [[sources/config-docs]] — config 命令家族的文档面，本任务保持其文档与实现一致
