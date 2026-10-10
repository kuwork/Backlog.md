---
title: BACK-692 - TUI 编辑键按文件位置路由目标
labels: [source, tui, bug, drafts]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-692 - Resolve-the-TUI-edit-keys-target-by-file-location-instead-of-status.md
---

# BACK-692 - TUI 编辑键按文件位置路由目标

在 frontmatter status 漂离 `Draft` 的草稿上按 TUI 编辑键（demote/promote 后的正常状态，二者都保留 status）会报 "Task DRAFT-1 was not found on this branch."。编辑会话按记录的状态选取存储，而其他所有面都按文件所在位置选取；本修复让编辑键与文件位置路由对齐。

## 解决方案

- `Core.editTaskInTui` 在任意查找之前从行自身的文件位置决定存储——将其目录与草稿目录比较；状态检查仅保留为无可用路径行的回退，裸 id 保持任务存储优先顺序
- 漂移是常态：demote 将文件复制进 `backlog/drafts/` 而不重写 `status:`，promote 刻意保留非 Draft 状态，且本仓库自己的草稿目录就有十五条漂移记录——该缺陷从已发布的 `draft list` 即可触达
- 镜像形态也修复了：位于 `backlog/tasks/` 下携带 `status: Draft` 的记录现在打开任务文件而非在草稿存储中查找；fail-closed 的双重身份防护不变
- 会话通过 `entity: "task" | "draft"` 报告解析到哪个存储（`TuiTaskEditEntity` 已导出），两个面都经 `editTargetNoun(entity)` 命名行，因此草稿行在只读、编辑器失败、未找到或标记已修改的提示中绝不会被称为任务
- 看板的编辑键补上缺失的 `ambiguous` 分支，渲染与任务列表相同的重命名提示，而非落到 "No changes detected"
- 测试：TUI 编辑会话套件新增四个用例（漂移草稿行、demote 产生的行、任务存储的 `Draft` 行、裸 id 编辑），断言于必须变更的文件；三变体 × 九用例的还原矩阵恰好使目标用例变红；文件内 15 个用例通过

## 验收标准

- 编辑 status 非 Draft 的草稿存储行会打开并落在草稿文件；demote 产生的行只编辑草稿文件
- 携带 `status: Draft` 的任务存储行改为编辑任务文件
- 无可用路径的行保持旧解析顺序；双重草稿身份仍然 fail-closed
- 提示在两个面中都将草稿称为草稿，看板以重命名提示渲染 ambiguous 结果

## Related Concepts

- [[concepts/task-identity]] — 按文件位置的存储路由与 fail-closed 身份
- [[concepts/cli-tui]] — 编辑会话与看板/任务列表提示面
- [[concepts/task-lifecycle]] — demote/promote 作为草稿状态漂移的来源

## Related Sources

- [[sources/demote-to-draft-action]] — 本修复处理其输出行的降级动作
- [[sources/back-693-tui-draft-creation-window]] — 复用实体名词助手（移至 `entity-noun.ts`）用于创建窗口的措辞
