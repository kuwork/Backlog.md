---
title: BACK-620 - 修复引用与文档区空态提示互换
labels: [source, web-ui, bug, i18n]
created_date: 2026-09-07 21:15
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-620 - Fix-swapped-empty-state-hints-for-references-and-documentation-sections.md
---

# BACK-620 - 修复引用与文档区空态提示互换

在 Web 任务详情模态框（也是编辑页和创建页）中，References 区与 Documentation 区的空态提示互换了——References 显示的是“No documents”提示，Documentation 显示的是“No references”——移除按钮的悬停标题也互换了。每当任务没有引用或没有文档时，用户会在错误的分区看到误导信息。

- `src/web/components/TaskDetailsModal.tsx`：四处用法换回正确位置——References 区现在渲染 `noReferences`/`removeReference`；Documentation 渲染 `noDocumentation`/`removeDocumentation`（语言键一直是对的；是第 1261/1338/1250/1327 行的用法互换了）
- `src/test/web-task-details-modal-documentation.test.tsx`：替换了把 bug 固化下来的断言，新增引用为空的测试，并新增按语言（en/zh-CN/zh-TW/ja）的互换检测测试
- 验证：定向套件 7/7 通过，tsc 干净，biome 退出码 0；按用户决定跳过全量套件

## 验收标准

- References 区显示引用专属的空态提示；Documentation 区显示自己的
- 移除按钮的悬停标题与其分区匹配
- 在所有支持的语言（en、zh-CN、zh-TW、ja）下验证行为
- tsc 与定向 bun test 通过

## Related Concepts

- [[concepts/web-ui-features]] — 任务详情模态框的小节渲染
- [[concepts/web-ui-i18n]] — 语言键正确但用法互换；新增按语言回归测试
