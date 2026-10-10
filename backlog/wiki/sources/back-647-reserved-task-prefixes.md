---
title: BACK-647 - 初始化时保留 draft/doc/decision 前缀
labels: [source, core, cli, i18n]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-647 - Reserve-draft-doc-and-decision-prefixes-at-init.md
---

# BACK-647 - 初始化时保留 draft/doc/decision 前缀

`backlog init --task-prefix` 接受任意纯字母值，包括硬编码的系统前缀 `draft`、`doc` 与 `decision`——所以用 `--task-prefix draft` 初始化的项目里，每个按前缀路由的消费方都把它的任务当草稿处理，ID 冲突在所难免。一个纯增量守卫现在校验每个入口的前缀，`doctor` 报告已损坏的项目。移植上游 BACK-635。

- `src/utils/prefix-config.ts` 是该规则的唯一属主：私有 `DOC_PREFIX`/`DECISION_PREFIX`（也被 `getPrefixForType` 复用、取代内联字面量）、`RESERVED_TASK_PREFIXES`、`isReservedTaskPrefix()` 与 `getTaskPrefixError()`（纯字母加保留名校验，按所给原样判定——init 逐字持久化该值，补过空白的输入现在也会被拒绝）
- 应用到每个入口：`src/cli.ts` 的 `--task-prefix` 旗标与交互向导的 `clack.text` 校验器（向导先 trim，空白仍意为默认）、`src/core/init.ts` 的 `initializeProject()` 使共享核心路径对任何调用方拒绝，浏览器初始化端点答 400 而非 500
- 已存在的保留前缀项目运行时保持可用：`task list`/`task create` 成功，重新 init 保留前缀，除非显式要求保留之一
- `backlog doctor` 报告冲突并点名盘上的 `task_prefix` 键，独立于重复 ID 发现以 1 退出，抑制 “no duplicates found” 行，并拒绝 `--fix`，使重复修复不能向冲突存储分配 ID；位于本 fork `--commit`/`--rollback` 分支之后的放置与上游不同，是有意的
- 保留名在 commander 选项、init 帮助模式与四语 Web 向导提示中文档化
- 测试：prefix-config/server-init/enhanced-init 共 111 通过，cli-doctor 与新 cli-init-reserved-prefix 套件共 19 通过（上游的旗标用例住在一个本 fork 没有的文件里）；在临时项目中端到端验证（`DECISION`/`draft` 被拒且无配置写入，`JIRA` 被接受，遗留 `task_prefix: draft` 项目仍列出与创建）

## 验收标准

- init 经旗标、向导、`initializeProject()` 与浏览器端点（400）大小写不敏感地拒绝 draft/doc/decision，不写配置
- 已存在的保留前缀项目保持可用；重新 init 保留其前缀
- doctor 以 `task_prefix` 键名报告冲突，以 1 退出，并拒绝 `--fix`
- 保留名在帮助与 Web 向导中跨语言文档化

## Related Concepts

- [[concepts/task-identity]] — 冲突的任务前缀会破坏的前缀路由
- [[concepts/core-architecture]] — 作为共享初始化路径的 `initializeProject`
- [[concepts/upstream-migration]] — 移植上游 BACK-635（提交 27ab33027）

## Related Sources

- [[sources/back-642-draft-identity-fail-closed]] — 本守卫保护的草稿前缀路由
- [[sources/back-596-fail-closed-document-decision-identity]] — 同样受保护的 doc/decision 前缀身份
- [[sources/back-593-init-backlog-cwd-runtime-core]] — 校验器接入的初始化流程与运行时核心
