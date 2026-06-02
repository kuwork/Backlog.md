---
type: concept
title: Markdown 解析与序列化流水线
updated: 2026-05-06
---

# Markdown 解析与序列化流水线

Backlog.md 的所有数据持久化都基于 Markdown 文件。解析和序列化流水线负责在 Markdown 文本和 TypeScript 领域对象之间双向转换。

## 解析流水线

```
原始 Markdown 文本
    ↓
parseMarkdown() — gray-matter 提取 frontmatter + content
    ↓
preprocessFrontmatter() — 处理 @user 语法、flow list 格式
    ↓
parseTask() / parseDocument() / parseDecision() / parseMilestone()
    ↓
领域对象（Task、Document、Decision、Milestone）
```

### Frontmatter 预处理

`preprocessFrontmatter()` 解决 YAML 解析的兼容性问题：
- `assignee: @user` → 转义为 `"@user"`，避免 YAML 解析错误
- `assignee: [@user, "someone"]` → 规范化 flow list 格式
- 日期字段统一归一化：支持 `YYYY-MM-DD`、`YYYY-MM-DD HH:mm`、ISO 格式、多种传统格式

### 结构化章节提取

`structured-sections.ts` 中的 `AcceptanceCriteriaManager` 和 `DefinitionOfDoneManager` 从 Markdown 正文中提取：

- **描述**：第一个非结构化段落
- **验收标准（AC）**：`- [ ] / - [x]` 复选框列表，带序号索引
- **实现计划**：代码块或列表
- **实现备注**：自由文本
- **最终总结**：自由文本
- **Definition of Done（DoD）**：全局和任务级别的检查清单

## 序列化流水线

```
领域对象（TaskUpdateInput / TaskCreateInput）
    ↓
serializeTask() — 组装 frontmatter + 结构化章节
    ↓
FileSystem.saveTask() — 写入磁盘
```

序列化时：
- Frontmatter 按固定顺序输出（id、title、status、assignee、reporter 等）
- 空值字段自动省略
- 日期格式统一为 `YYYY-MM-DD HH:mm`
- AC 和 DoD 以复选框列表形式写入正文

## 文件命名规范

- **任务**：`{prefix}-{id} - {sanitized-title}.md`（如 `TASK-001 - 实现搜索功能.md`）
- **草稿**：`draft-{id} - {title}.md`
- **文档**：`doc-{id} - {title}.md`
- **决策**：`decision-{id} - {title}.md`
- **里程碑**：`{id}.md`

## 跨分支兼容性

由于所有数据都是纯 Markdown，跨分支合并时不会产生二进制冲突。Git 可以正常 diff 和 merge 任务文件。这也是跨分支任务感知功能的基础——直接通过 `git show` 读取其他分支上的 Markdown 内容即可。
