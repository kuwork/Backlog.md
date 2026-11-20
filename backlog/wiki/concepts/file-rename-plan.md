---
title: 文件更名计划（FileRenamePlan）
labels: [concept, core, rename, references, transaction]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
---

# 文件更名计划（FileRenamePlan）

`FileRenamePlan` 是任务、文档、决策标题或 ID 变化的共享事务边界：先在内存中计算主文件与引用变更，再一次性 preflight、安装和回滚，避免文件已改名而引用只修了一半。

## 核心不变量

- **计划与执行分离**：builder 只接收旧/新项目根相对路径、实体路由信息和候选文件，产出 before/after，不在构建阶段写盘。
- **逐文件解析相对路径**：同一旧文件可被不同深度页面用不同相对路径引用；每个引用独立 resolve，再生成新相对地址，不能做全局字符串替换。
- **精确匹配**：结构化字段、Wiki `source_path` 与实体 slug 只修改精确目标；普通裸 ID 散文、wikilink、代码、外部 URL 与无关路由保持原样。
- **原子应用**：目标冲突、输入内容变化或安装失败都不得留下部分更新；自动提交覆盖主文件移动与全部引用变更。
- **无变化不写**：sanitize 后路径不变、没有引用命中时保持原保存流程。

## 引用范围

活动/已完成任务、其他文档、决策、里程碑文档字段和可选 Wiki 内容页共用一套重写。Wiki 只处理内容页中的相对 Markdown 链接与 `source_path`；`wiki_output/`、`index.md`、`overview.md`、`log.md` 属于摄取维护边界，不由实体更新直接改写。缺失 Wiki 是空候选集，不创建目录。

相对链接保留文字、query、fragment 和行/页范围。`/task/:id/:title`、`/documentation/:id/:title`、`/decisions/:id/:title` 仅在实体 ID 与旧标题段同时匹配时更新对应段，无标题短链接不动。

## 入口收敛

- BACK-854：文档标题更新接入，建立共享计划。
- BACK-855 / BACK-856：任务与决策标题更新复用同一计划，各自只触发本实体路由。
- BACK-858：扩展为 ID 更新与 `--source-path` 精确源选择，CLI/MCP 共用 Core；不建立平行 rename 命令。
- BACK-850 / BACK-851：Web 文档与文件夹移动复用 rename 能力，不新增目录移动 API。

## 常见陷阱

旧任务的未加引号 `@handle` 必须由共享 frontmatter 兼容入口处理，否则构建计划时就会失败；其它损坏 YAML 仍应显式报错。同名重复 ID 必须要求 source path，目标等价 ID 冲突和目标路径冲突都应在任何写入前失败。

## Related Concepts

- [[concepts/task-identity]] — ID 等价、重复身份和任务层级约束
- [[concepts/relative-reference-resolution]] — 项目根边界与相对地址解析
- [[concepts/core-architecture]] — CLI/MCP/Web 共享 Core 写入口

## Related Sources

- [[sources/back-854-document-rename-reference-repair]] — 建立计划并接入文档
- [[sources/back-855-task-title-file-rename]] — 任务标题更新接入
- [[sources/back-856-decision-title-file-rename]] — 决策标题更新接入
- [[sources/doc-36-entity-id-update-design]] — ID 更新设计
- [[sources/back-858-entity-id-update-source-selection]] — ID 更新与精确源选择实现

## Related Decisions

- [[decisions/extend-update-for-entity-id-changes]] — 扩展现有 update 而非新增 rename 命令
