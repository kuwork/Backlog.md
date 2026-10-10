---
title: BACK-674 - 文档排序标签改 Title 并给决策加排序开关
labels: [source, web-ui, sidebar, sorting]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-674 - Rename-the-documents-sort-label-to-Title-and-add-the-same-sort-toggles-to-decisions.md
---

# BACK-674 - 文档排序标签改 Title 并给决策加排序开关

文档树第一个排序开关标为 `Name`，但一直按文档标题排序（它自己的 tooltip 已写 "Sort by title"）。本任务修正措辞，并给决策小节——同样两个字段的平面列表——同款 Title/ID 开关对。

- 文档侧改动仅显示层：语言 key（`sortDocsByName`）、列 id（`'name'`）与比较器都不动，调用方与测试零移动；改 key 名会是超出要求的更大改动，且 key 名不对用户可见
- 决策是平面列表，因此 `sortDecisions(items, column, direction)` 对显示的数组排序一次，无文件夹钉扎、无变异；标题为默认升序列，ID 走共享 `compareTaskIds`（`decision-2` 在 `decision-11` 前），标题比较器作决胜
- 两种列下行仍打印 `decision.title`——ID 列只重排，与文档树一致；这是相对 wiki 树的有意差异，wiki 树的标签跟随所选列（BACK-672）
- 三个侧边栏小节现在共享 `renderSortButton`，只差所读状态
- 测试范围教训：三个小节都渲染 `aria-label` 为 "Sort by title" 的开关，查找必须先范围到小节容器（BACK-672 笔记建议的变通）
- 实测需要经 `BACKLOG_CWD` 的临时项目，因为仓库只有一条决策；五条决策验证了默认、ID 切换、方向翻转与重启，外加 280px 窄侧边栏布局
- 记录的 CDP 坑：Bun 的 keep-alive 池在复用连接上第二次请求会从 Chrome DevTools HTTP 服务器得到 404；`Connection: close` 修复
- ID 撞车：分配器把 BACK-674 给出是因为 `back-673` 存在于另一个本地分支，但 674 已在迁移台账分配；fork 保留编号、不重编号，台账簿记留给单独变更

## 验收标准

- 文档标题开关在四本字典中打印 `Title`，key、列 id、默认与顺序不变
- 决策头部在新建按钮左侧渲染 Title/ID 开关，标题升序默认
- ID 列按决策 ID 数字排序，行仍打印标题
- 点击激活列翻转，点击未激活列从升序重启；四种语言带标签与 tooltip
- 测试覆盖决策排序与改名后的文档标签，查找范围到小节

## Related Concepts
- [[concepts/web-ui-features]] — 现在文档/wiki/决策统一的侧边栏小节约定
- [[concepts/task-identity]] — 共享数字 ID 比较器 `compareTaskIds`
- [[concepts/web-ui-i18n]] — 跨四本字典改标签，key 不动

## Related Sources
- [[sources/back-667-sidebar-docs-sort-toggles]] — 被改名标签与开关模式的发源地（批次兄弟）
- [[sources/back-672-wiki-tree-sort-toggles]] — 标签跟随列行为被刻意不同对待的兄弟小节（批次兄弟）
- [[sources/back-574-decision-list-view-update-commands]] — 早期决策面工作
