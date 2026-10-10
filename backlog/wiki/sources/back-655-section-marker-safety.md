---
title: BACK-655 - 拒绝嵌套小节标记并修复追加截断
labels: [source, markdown, core, cli, upstream-migration]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-655 - Reject-nested-section-markers-in-notes-and-fix-append-truncation.md
---

# BACK-655 - 拒绝嵌套小节标记并修复追加截断

`buildSectionBlock` 包装小节负载时不调和其中已有的哨兵行，于是 `--notes` 可能嵌套标记——写入报告成功，而 `task view` 只显示内层结束标记之前的部分——读取路径还会截断仅仅行内提到终止符的 notes。本任务移植上游修复：一个行锚定、深度感知的哨兵扫描器，加上在共享 core 输入边界拒绝标记行，并把围栏代码块扫描器升级为完整 CommonMark 实现。

- `src/markdown/structured-sections.ts` 中五条哨兵路径正则被一个行锚定、计深度的 `findSentinelBlocks` 取代，提取、小节区间、起止查找与剥离共用；`tokenizeKnownSentinels` 同样行锚定，行内标记再不可能遮蔽或终止一个小节
- 新的 `assertSectionInputHasNoMarkerLines` + `assertSectionInputsSafe` 守卫设在共享 core 输入边界（`src/core/backlog.ts` 的 `createTaskFromInput` / `applyTaskUpdateInput`），整体拒绝以自身标记作为整行的输入，覆盖 description、plan、notes、final summary 及各 append 变体——CLI、MCP、Web 服务端与 TUI 共享；策略是拒绝而非剥离，缩进一个空格是文档化的逃生口
- 围栏代码块扫描器升级为完整 CommonMark 版本（列表容器缩进、反引号 info 字符串、原始 HTML 块类型 1-7），取代 BACK-643 的简化扫描器，堵住两个真实的内容丢失场景；该文件现在与上游版本逐字节一致（blob 67d4f74eb）
- 刻意行为变更：嵌入了所在小节标记行的围栏示例过去能作为嵌套块往返；现在它会变成点名该标记的明确错误，BACK-643 的往返断言被显式拒绝测试取代
- 测试脚手架发现：Windows 上 Bun 会把真实的多行 argv 元素截断到第一行，因此 CLI 测试经 CLI 文档化的换行转义传入多行文本——这个平台限制最初看起来像产品 bug
- 测试：新的 `src/test/section-marker-safety.test.ts`（11 个用例，修复前 9 个红）外加完整 24 用例围栏套件（从 7/24 红变为全绿）；`buildSectionBlock` 保持宽容，既有嵌套文件仍可读并在下次干净重写时修复

## 验收标准

- 包含目标小节自身标记作为整行的小节输入在任何写入前被拒绝，错误信息点名该标记
- 行内提到标记、缩进的标记行、围栏内其他小节的标记都逐字节往返
- 行内提到结束标记的 notes 正文在读取或 `--append-notes` 时不再被截断
- 既有嵌套标记文件渲染完整内部，干净的 `--notes` 重写会剥掉嵌套区域
- 一个共享的行锚定深度感知扫描器取代五条哨兵正则；围栏扫描器跑通完整 CommonMark 套件（24/24 绿）

## Related Concepts

- [[concepts/markdown-pipeline]] — 本任务重写的 structured-section 哨兵与围栏扫描
- [[concepts/upstream-migration]] — 移植上游 BACK-660（3d73793b9）及来自 b2fbf08dc 的围栏工作
- [[concepts/task-identity]] — 小节内容才是持久记录；fail-closed 拒绝优于静默篡改

## Related Sources

- [[sources/back-530-append-description]] — 本次修复截断问题的 append 式小节写入
- [[sources/back-537-deterministic-checklist-serialization]] — 相邻的 structured-section 序列化工作
