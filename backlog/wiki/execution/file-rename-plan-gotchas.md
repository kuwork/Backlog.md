---
title: 文件更名与引用同步陷阱
labels: [execution, core, rename, references]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
extracted_from:
  - BACK-854
  - BACK-855
  - BACK-856
  - BACK-858
---

# 文件更名与引用同步陷阱

## 适用场景

修改任务、文档、决策的标题或 ID，新增某类实体的更名入口，或排查改名后链接失效、部分文件写入、重复 ID 误改和 auto-commit 漏文件。

## 标准步骤

1. 从持久化记录读取旧身份与旧路径，用共享 filename generator 计算新路径；只有 sanitize 后路径确实变化才构建 `FileRenamePlan`。
2.  builder 接收项目根相对旧/新路径和实体路由信息，枚举活动/完成记录、文档、决策、里程碑及 Wiki 内容页，先产出全部 before/after，不写盘。
3. 每个 Markdown 引用从所在文件目录独立 resolve；结构化字段和 `source_path` 只接受精确旧路径，实体 slug 同时校验 ID 与旧标题段。
4. 应用前检查目标不存在、输入内容未变化和任务层级约束；失败保持源文件与所有引用不变，成功后把主文件移动和每个引用纳入 auto-commit。
5. 回归至少覆盖 no-op、目标冲突、不同目录深度、空格/非 ASCII、query/fragment/range、Wiki 缺失、重复 ID、旧 frontmatter 与回滚。

## 常见陷阱

- **全局替换相对路径**：相同文本在不同引用文件中可能指向不同目标，必须逐文件解析。
- **绕过共享 frontmatter 解析**：历史任务未加引号的 `@MrLesk` 会在计划构建阶段抛 YAMLException；兼容逻辑只应存在一份。
- **误改 Wiki 维护文件**：实体更名不能顺手更新 `index.md`、`overview.md`、`log.md` 或 `wiki_output/`，这些由摄取流程维护。
- **误改普通裸 ID**：ID 更新不是文本替换，只处理精确结构化身份、路径和路由。
- **把 reparent 与重编号合并**：跨 parent 移动和带 children 的父 ID 改变有额外层级风险，必须独立拒绝或独立命令处理。
- **CLI 做完再补 MCP**：source/target 参数和错误码应先进入共享 Core，再映射到各 surface。

## Related Sources

- [[sources/back-854-document-rename-reference-repair]] — 共享计划与真实迁移文档验证
- [[sources/back-855-task-title-file-rename]] — 任务入口
- [[sources/back-856-decision-title-file-rename]] — 决策入口
- [[sources/back-858-entity-id-update-source-selection]] — ID 更新、source path 与 MCP  parity

## Related Decisions

- [[decisions/extend-update-for-entity-id-changes]] — 不建立平行 rename 工作流
