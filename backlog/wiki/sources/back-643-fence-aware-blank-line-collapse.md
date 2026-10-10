---
title: BACK-643 - 保留笔记代码块内连续空行
labels: [source, cli, markdown]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-643 - Preserve-consecutive-blank-lines-inside-fenced-code-blocks-in-notes-issue-930.md
---

# BACK-643 - 保留笔记代码块内连续空行

`task edit --notes` 与 `--append-notes` 用全局换行折叠规范化小节内容，所以围栏代码块内的空行在每次编辑时被静默改写——代码样例无法往返。一个新的围栏感知辅助函数取代四个规范化点，围栏内容逐字节存活而散文保持折叠。移植上游 BACK-637（issue 930）。

- `src/markdown/structured-sections.ts` 新 `collapseBlankLines(text)`：单遍跟踪器，三个以上反引号或波浪线、缩进至多三个空格处开围栏，行重复起始字符至少同样多次且仅尾随空白处关围栏，未闭合围栏视为保护剩余部分
- 替换全部四个换行折叠——小节正文提取器、小节块构建器、小节剥离路径与评论内容写入器——`updateStructuredSections`、`stripSectionInstances`、`stripCommentsSection` 与 `updateCommentsContent` 共享一条围栏规则，无重复逻辑
- 围栏外行为不变：连续两个以上空行折叠为一个，前导空行丢弃，尾随空行留给调用方现有 `.trim()`/`.trimEnd()`
- 该辅助函数是纯文本扫描而非 Markdown 解析器：围栏状态在任何小节逻辑之前查询，围栏内形似小节标记的行保持为围栏内容
- 新 8 测试套件 `src/test/structured-sections-code-fences.test.ts`（反引号/波浪线/未闭合围栏、围栏内形似小节的行、散文折叠、笔记替换、评论重写循环）
- 验证：12 个定向 markdown/comments/notes 套件 163 通过 / 0 失败；tsc 与 biome 干净（首次运行显示 9 个来自 git-init 套件的假超时，需要 `--timeout 240000`）

## 验收标准

- 带连续空行的围栏代码块（反引号与波浪线）在笔记写入与追加时逐字节存活
- 未闭合围栏把小节剩余部分保持为围栏内容并保留
- 围栏外散文保持现有折叠为一个的规范化
- 一个共享的围栏感知辅助函数服务每个规范化点

## Related Concepts

- [[concepts/markdown-pipeline]] — 本围栏感知规范化加入的结构化小节序列化
- [[concepts/upstream-migration]] — 移植上游 BACK-637（提交 b2fbf08d）

## Related Sources

- [[sources/back-537-deterministic-checklist-serialization]] — 小节正文稳定 markdown 序列化的相邻工作
- [[sources/back-470-task-comments]] — 评论解析/重写循环由共享辅助函数覆盖
