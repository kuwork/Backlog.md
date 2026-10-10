---
title: BACK-650 - 纯标点标题回退占位文件名
labels: [source, core]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-650 - Fall-back-to-a-placeholder-filename-for-punctuation-only-titles.md
---

# BACK-650 - 纯标点标题回退占位文件名

像 `!!!` 这样的纯标点标题会被清洗成空片段，生成 `back-42 - .md`。空片段本身可以往返，但 `<id> - ` 前缀对多个文件名读取器是承重结构，因此 `sanitizeFilename`——文件名清洗的唯一属主——现在回退到 `untitled` 占位符，而不是输出空片段。

- 修复由单个函数持有：`sanitizeFilename`（`src/file-system/operations.ts`）返回清洗后的值或 `'untitled'`，于是 `!!!` 标题生成 `task-1 - untitled.md`；全部四个调用点（saveTask、saveDraft、saveDecision、saveDocument）自动继承，frontmatter 标题保持 `!!!` 原样
- `<id> - <title>.md` 形态是承重结构：content-store 的任务监视器从第一个空格前的片段取 ID，decision 监视器与 `task-path` 的 ID 查找按 ` - ` 切分，文档保存去重按 `base.split(' - ')[0]` 匹配，文档树同样给节点命名，重复任务修复拒绝在没有分隔符时重建路径——纯 ID 文件名会破坏所有这些
- `src/test/filesystem.test.ts` 新增 5 个用例覆盖任务、草稿、决策与文档，包括两种文件名切分器的 ID 恢复，以及一次必须仍然去重为单个文件的文档重存；回退该回退逻辑会让 5 个中的 4 个变红（第 5 个是形态守卫）
- 在一次性项目中端到端验证：`task create '!!!'` -> `task-1 - untitled.md`，doc 与 draft 同理，`task list` 仍渲染 `!!!` 标题；定向运行 74 通过，tsc 与 biome 干净

## 验收标准

- 纯标点标题产生非空标题片段（如 `task-42 - untitled.md`）
- 文件名保持 `id - title.md` 形态；不引入纯 ID 文件名
- 测试覆盖任务、文档与决策的纯标点标题

## Related Concepts

- [[concepts/task-identity]] — 依赖该分隔符的文件名派生 ID 恢复
- [[concepts/core-architecture]] — 所有实体存储共享的单属主清洗

## Related Sources

- [[sources/back-538-duplicate-task-id-recovery]] — 分隔符依赖读取器之一的重复任务修复
- [[sources/back-642-draft-identity-fail-closed]] — 受同一不变量保护的文件名派生草稿身份
