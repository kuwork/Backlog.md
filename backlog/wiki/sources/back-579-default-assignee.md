---
title: BACK-579 - defaultAssignee 配置落地
labels: [source, migration, config, core, cli, mcp]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-579 - Implement-defaultAssignee.md
---

# BACK-579 - defaultAssignee 配置落地

让文档已记载但无效的 `defaultAssignee` 配置真正生效。`ADVANCED-CONFIG.md` 描述了该设置，但 `config get`/`config set` 把它当未知键拒绝，且非测试代码无人读取。任务将其作为字符串列表端到端接通，在所有界面的任务创建期间应用，并加固配置文件 watcher，使畸形值不再驱逐上一份良好的缓存配置。

## 实现要点

- 类型变更：`defaultAssignee` 在 `BacklogConfig` 中变为 `string[]`（匹配多负责人任务模型）；解析接受遗留标量、行内数组和 YAML 块序列；序列化写行内列表并在为空时省略该键。
- `src/cli.ts`：加入 `CONFIG_GET_KEYS`/`CONFIG_SET_KEYS`/`CONFIG_AVAILABLE_KEYS`；`config get` 打印逗号连接值；`config set` 使用共享 `parseDelimitedStringList`（空值存 `undefined` 以删除该键）；`config list` 打印带括号列表。
- 默认值应用在 `core.createTaskFromInput`——与 `defaultStatus` 和 `definitionOfDone` 同层——而不是 CLI：每个创建界面（CLI task create、draft create、创建向导、TUI 创建器、Web POST `/api/tasks`、MCP `task_create`）都经它漏斗，一处改动即统一行为。空/缺失负责人输入应用默认值；任何显式负责人完全替换它（不合并）。
- 配置 watcher 加固：把上游 `hasValidExplicitValues` 校验迁移进 `src/utils/config-watcher.ts`（适配 fork 支持的键，含按评审恢复 task_prefix 纯字母校验）；watcher 做稳定读取且只发布通过校验的配置，在畸形编辑时保留上一份良好配置缓存。新的 `FileSystem.getCachedConfigContent`/`publishConfig` helper；`parseConfig` 改为公开；`saveConfig` 保持缓存内容同步。
- `ADVANCED-CONFIG.md` 和任务创建指南更新为描述已发布列表行为。
- 测试：新的 `src/test/config-watcher.test.ts`（有效发布、畸形拒绝、标量/行内/块 defaultAssignee 形式、task_prefix 校验）；CLI、draft create 和 core 覆盖默认应用与显式覆盖路径。

## 验收标准

- `config get/set/list` 都支持 `defaultAssignee`；不带 `-a` 的 `task create` 应用配置的默认值；显式 `-a` 覆盖它。
- `ADVANCED-CONFIG.md` 准确描述已发布行为；畸形配置值在 watcher 中不替换上一份良好缓存配置。

## Related Concepts

- [[concepts/core-architecture]] — 在 core 漏斗层应用的默认值一次覆盖所有创建界面
- [[concepts/task-lifecycle]] — 负责人模型与创建时默认值
- [[concepts/cli-entry]] — config get/set/list 键注册表

## Related Sources

- [[sources/back-533-config-block-yaml-lists]] — 本任务构建于其上的配置 YAML 列表解析
- [[sources/back-581-web-settings-default-assignee]] — 同一设置的 Web Settings 编辑器（同批次）
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — CLI-2 深度分析（上游 BACK-583，合并 `84ea3fa`）
