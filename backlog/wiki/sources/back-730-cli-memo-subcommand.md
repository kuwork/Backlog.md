---
title: BACK-730 - CLI memo subcommand
labels:
  - source
  - cli
  - feature
created_date: '2026-10-03 01:07'
updated_date: '2026-10-03 01:14'
source_path: backlog/tasks/back-730 - CLI-memo-subcommand.md
---

# BACK-730 - CLI memo subcommand

Memos 存在文件里，最快的捕获路径是终端：`backlog memo create "..."` 应像 `backlog decision create` 一样工作。由于 memos 刻意不复用 doc 通道（日期+序号 ID、无标题），需要一个轻量子命令组，与 HTTP API 共享同一存储模块 src/core/memos.ts，保证 CLI 与 server 一套 ID 方案、一种文件格式。

实现：在 src/cli.ts 中参照 decision 命令组（cli.ts:5006）的 house style（addHelpSchema、.option 声明、async action、纯文本输出）新增 memo 命令组，含 create / list / update / delete；每个子命令像相邻命令一样解析项目根并委托 src/core/memos.ts。create 支持 --content 内联，省略时从 stdin 读取正文（多行捕获、shell 引号简单），--tags 逗号分隔；list 按最新在前逐行输出 "<id>\t…" 并带 --limit 和下一页游标提示；update 支持 --content 替换 / --append 追加一行；delete 报告成功或未找到。CLI 纯文本搜索输出跳过 memo 结果（与 wiki 结果视为 web-only 一致）。

四次 follow-up 迭代：补交使用指南（src/guidelines/cli-instructions/memos.md，注册为 'backlog instructions memos'，CLI-only 指南而非 MCP workflow resource）；memo list 增加 --plain 并新增 `memo view <id>`（TTY 走 scrollableViewer 分页，非 TTY/--plain 直接打印，对齐 decision view）；list 输出从 displayTitle 改为一行预览（正文前 20 字符、去换行、截断加省略号，全文经 memo view 查看）；list 增加 --date 与 --tags（逗号分隔或可重复、大小写不敏感、任一匹配）过滤器，且 listMemos 跳过 id 为空的损坏 memo 文件。backlog/memos/ 文件是临时数据，刻意不入版本库。

结果：scratch 项目人工验证（内联 create、stdin create、list、help、update/delete/错误路径）通过，src/test/cli.test.ts 94 个测试通过，tsc 与 biome 干净。

## Related Concepts

- [[concepts/cli-entry]] — src/cli.ts 命令组组织方式与 addHelpSchema 惯例
- [[concepts/cli-instructions]] — 'backlog instructions memos' 指南注册体系
- [[concepts/memos]] — backlog memo 命令组所属的快速笔记子系统

## Related Sources

- [[sources/back-728-memo-storage-layer]] — 子命令直接委托的共享存储模块
- [[sources/back-729-memo-http-api]] — 共享同一存储模块的 HTTP API 面
- [[sources/m-8-agent-cli-workflow]] — CLI 指令指南体系（overview 注册先例）
