---
title: BACK-533 解析 config 块状 YAML 列表
labels: [source, config, cli]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-533 - Parse-block-style-YAML-lists-in-config-and-fix-config-set-guidance-for-list-keys.md
---

# BACK-533 解析 config 块状 YAML 列表并修正列表键指引

让手编辑的 `config.yml` 中的块状 YAML 序列（statuses、labels）能被正确解析。

## 问题

- `parseConfig` 只接受内联 flow 数组形式的列表键，块状 YAML 序列被静默丢弃，破坏手编辑 config.yml 的路径
- `config set` 对不可设置的列表键指引指向不存在的 `list-<key>` 命令

## 解决方案

- `src/file-system/operations.ts`：`parseConfig` 先经 gray-matter YAML 通道解析 statuses/labels，保留内联括号行解析作为旧版非 YAML 配置的兜底
- `src/cli.ts`：提取共享的 `CONFIG_AVAILABLE_KEYS` 常量，使 config get/set 显示一致的可用键列表，列表键指引改为 `backlog config get <key>` 加编辑 config.yml

## 测试

`src/test/config-commands.test.ts`（12/12，新增 4 项：块状 vs 内联等价、带引号逗号保留、端到端 config get、指引一致性）。

## Related Concepts
- [[concepts/core-architecture]] — 配置解析层
- [[concepts/cli-entry]] — config 命令

## Related Sources
- [[sources/config-docs]] — 配置文档与决策记录
