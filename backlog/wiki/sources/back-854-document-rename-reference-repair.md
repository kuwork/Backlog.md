---
title: BACK-854 - 文档更名引用修复
labels: [source, core, documentation, rename, references]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-854 - Fix-stale-relative-references-after-document-title-renames.md
---

# BACK-854 - 文档更名引用修复

文档标题导致文件名变化时，以独立 `FileRenamePlan` 原子修复任务、文档、决策和 Wiki 中的相对路径、结构化字段与文档路由 slug。

## 问题

原有文档改名只移动主文件，其他文件仍保留旧路径。不同深度的引用不能用字符串替换统一处理；Wiki 的 `source_path` 与维护文件也必须区别对待。真实迁移文档还暴露出旧任务中未加引号的 `@handle` 会绕过兼容解析、阻断整个更名。

## 解决方案

- 构建计划时不写盘，逐个引用文件解析旧目标，再计算各自的新相对路径；保留链接文字、query、fragment 与行/页范围。
- 结构化任务字段和 Wiki `source_path` 只更新精确旧路径；代码、wikilink、外部 URL 与无标题短链接不动。
- 统一文档/任务/决策三类 slug 规范化，但本任务只把文档路由接入文档更新入口。
- 应用阶段做目标与内容 preflight、分阶段写入、备份、硬链接安装和失败回滚；自动提交包含主文件与全部引用。
- 缺失 Wiki 视为空集合，不创建目录，也不直接改 `wiki_output/`、`index.md`、`overview.md`、`log.md`。
- 旧 handle 兼容收敛到共享 `parseFrontmatter`，其它损坏 YAML 仍显式失败。

## 验证

相关测试 108 项通过、335 条断言，文档 Core 5 项通过；TypeScript 与 Biome 通过。真实迁移文档改名后，旧相对链接及其行范围均指向新文件。

## Related Concepts

- [[concepts/file-rename-plan]] — 原子更名与引用同步计划
- [[concepts/relative-reference-resolution]] — 项目根边界与逐文件相对路径
- [[concepts/task-identity]] — 三类实体 ID 与 slug 等价规则

## Related Sources

- [[sources/doc-36-entity-id-update-design]] — 后续 ID 更新复用同一计划
- [[sources/back-855-task-title-file-rename]] — 计划接入任务标题更新
- [[sources/back-856-decision-title-file-rename]] — 计划接入决策标题更新
