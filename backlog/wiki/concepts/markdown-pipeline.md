---
title: Markdown 解析与序列化流水线
labels: [concept]
created_date: 2026-05-06 00:00
updated_date: '2026-09-26 14:45'
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

### 确定性清单解析（BACK-537）

`structured-sections.ts` 已将 regex 哨兵匹配替换为 **tokenizer + 区间解析器**：
- tokenize 所有已知哨兵、屏蔽外来族区间、配对 AC/DoD 标记
- 对歧义结构 **fail-closed**（不猜测，避免静默损坏）
- `--ac`/`--acceptance-criteria` 在 task edit 保持叠加别名；`--clear-ac` 通过 `acceptanceCriteriaSet=[]` 原子清空
- 使 AC/DoD 编辑与序列化确定性化

### 文档内锚点链接（BACK-536）

- `MermaidMarkdown` LinkComponent 拦截 `#heading` href，在当前文档上下文内平滑滚动 + `history.pushState`
- 标题 ID 由 `rehypeHeadingMetadata` 插件生成 github-slugger ID，人类可读锚点（`#A1`、`<#A1: Section Title>`）仍可解析
- `normalizeMarkdownHashLinks`（remark/unified）在文档/决策保存时把人类可读 TOC 锚点改写为 github-slugger slug

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

## 渲染安全：HTML 实体转义

`MermaidMarkdown.tsx` 中的 `sanitizeMarkdownSource` 在渲染前对 `<` 进行转义（`→ &lt;`），防止 HTML-like 标签被浏览器解析为实际 DOM 元素。

**保护机制（BACK-476）**：
- 先扫描围栏代码块（`` ``` ``）和行内代码（`` ` ``）的偏移范围
- `<` 替换时跳过受保护范围，避免代码内容被双重编码
- 代码区外的 URI/邮箱自动链接（`<mailto:...>`）仍正常豁免

## 跨分支兼容性

由于所有数据都是纯 Markdown，跨分支合并时不会产生二进制冲突。Git 可以正常 diff 和 merge 任务文件。这也是跨分支任务感知功能的基础——直接通过 `git show` 读取其他分支上的 Markdown 内容即可。

## gray-matter 缓存投毒防护（BACK-599）

gray-matter 的默认 options 缓存会在 options 对象引用变化时反复 miss、在共享引用时投毒共享条目。修复：

- 新建 `frontmatter.ts` 作为**全仓库唯一 gray-matter 导入点**
- `parseFrontmatter` / `stringifyFrontmatter` 传空 options 显式禁用缓存
- 全部既有调用点迁移到该模块；**新调用点必须走 frontmatter.ts**，禁止直接 import gray-matter

## Bun shell 插值陷阱（BACK-597）

Bun shell 模板插值多行内容时会截断后续参数：内插值含真实换行会破坏命令行边界。修法是把多行内容**预转义为字面 `\n`** 再内插，让换行以转义形式安全穿过 shell 解析。

## 围栏感知空行折叠（BACK-643）

notes 序列化时的连续空行折叠现在是 fence-aware 的：围栏代码块内的连续空行原样保留，只有代码块外的空行才被折叠，避免改写用户有意保留的代码格式（issue 930，[[sources/back-643-fence-aware-blank-line-collapse|BACK-643]]）。

## 行锚定哨兵扫描（BACK-655/635）

结构化章节的哨兵检测进一步收紧：

- **深度感知**：notes 中的嵌套 section 标记（如代码块或引用里出现的 `## Acceptance Criteria`）被拒绝，不再误当作真实章节边界；同时修复了 append 截断问题（[[sources/back-655-section-marker-safety|BACK-655]]）
- **extractSection 行锚定**：`parser.ts` 的 `extractSection` 正则 `## Title\s*\n` 原会吞掉分隔空行，导致空章节在 read-then-write 时吞并下一个标题、重复 `## Decision`/`## Consequences`；现为两端行锚定，core 也改为复用该实现而非自带副本（[[sources/back-635-decision-status-editing|BACK-635]]）

## Mermaid 围栏大小写（BACK-640）

Mermaid 渲染修复的一部分是围栏标记大小写处理——大写/混合大小写的 ` ```mermaid ` 围栏此前无法识别渲染；连同应用主题与编辑器预览 pane 一并修复（[[sources/back-640-mermaid-rendering-fixes|BACK-640]]）。

## Related Sources
- [[sources/back-537-deterministic-checklist-serialization]] — BACK-537 清单确定性解析
- [[sources/back-536-in-document-hash-links]] — BACK-536 文档锚点链接
- [[sources/back-599-gray-matter-no-cache-parse-wrapper]] — BACK-599 gray-matter 无缓存封装
- [[sources/back-597-fix-cli-test-failures-doc-update-path-task-list-grouping]] — BACK-597 Bun shell 插值陷阱
- [[sources/back-635-decision-status-editing]] — BACK-635 extractSection 行锚定修复
- [[sources/back-640-mermaid-rendering-fixes]] — BACK-640 Mermaid 围栏大小写与渲染修复
- [[sources/back-643-fence-aware-blank-line-collapse]] — BACK-643 围栏感知空行折叠
- [[sources/back-655-section-marker-safety]] — BACK-655 嵌套哨兵拒绝与 append 截断修复
