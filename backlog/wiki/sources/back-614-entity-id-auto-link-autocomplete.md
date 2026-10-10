---
title: BACK-614 - web markdown 实体 ID 自动链接与输入侧补全
labels: [source, web-ui]
created_date: 2026-09-07 02:53
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-614 - Auto-link-entity-IDs-in-web-markdown-with-input-side-insert-link-hint.md
---

# BACK-614 - web markdown 实体 ID 自动链接与输入侧补全

写进 web UI markdown 的裸实体 ID（任务、文档、决策、草稿、wiki 路径）渲染为纯文本，用户只能复制 ID 再搜索。本任务迁移并扩展上游任务 ID 深链能力：fail-closed 的渲染侧自动链接器在所有 markdown 展示字段中链接已知 ID，输入侧前缀自动补全一键物化链接——两者共享由 App 已加载语料构建的同一规范实体索引（无新增 API 调用）。

- `src/web/utils/task-id-links.ts`（新增）：规范实体索引（tasks + documents + decisions + drafts，规范碰撞按歧义丢弃）+ 零填充感知升序前缀查询（每类 top 5；wiki 路径字典序 top 5）+ remark AST 链接插件——行内/围栏代码结构性排除、既有链接保留目标、边界规则拒绝标识符尾部；空索引不链接任何内容。
- `src/web/contexts/TaskIdIndexContext.tsx`（新增）：索引经 `useMemo` 从已加载语料生成，由 React Context 分发，WebSocket 语料变化时自动更新。
- 渲染侧接入 `MermaidMarkdown.tsx` 与 `DependencyInput.tsx` chips（命中成为指向 `/task/<canonical>` 的 react-router Link，未命中保持纯文本）；路由族匹配 BACK-511 短别名，href 去前缀（`/task/506` 而非 `/task/BACK-506`）。
- `src/web/hooks/useEntityAutocomplete.ts` + `src/web/components/EntityLinkAutocomplete.tsx`（新增）：200ms 防抖、光标绑定 token 提取、光标下方带类型徽章的 listbox、方向键选择、Enter 插入空格填充的 markdown 链接、单一候选直接插入、Escape 关闭不重开；按候选字符串键控的负缓存，索引变化时整体失效；IME 组合输入既不拦截也不触发。
- 未保存编辑守卫：`TaskDetailsModal.tsx` 内容区 capture 阶段点击守卫——isDirty / 评论草稿 / 任意已填创建模式字段在离开类链接前询问确认；同页锚点、修饰键新标签页、非 http 协议豁免。
- 键提取：fork 的 `canonicalTaskId` 原在 `src/utils/task-path.ts`（import node:path/core，破坏 web 构建）；移到纯模块 `src/utils/task-id.ts` 并由 task-path 重导出——单一实现，行为零变化。
- @uiw/react-md-editor v4 去掉 `textareaProps.ref`；textarea 经包装 `querySelector` + MutationObserver 获取。
- 验证：64 个新测试（task-id-links 24、autocomplete 22、chips 4、modal guard 6、mermaid +8）；全量 bun test 2129 pass / 0 fail；真实浏览器验证自动链接、chips 与 autocomplete 交互。

## 验收标准

- 匹配索引的裸任务/实体 ID 在所有 web markdown 字段渲染为链接；未知 ID 保持纯文本。
- 代码 span/块内的 ID 不链接化；既有链接保留目标；标识符尾部拒绝。
- 输入侧菜单：200ms 防抖、前缀以空白/行首为界、top 5 升序、方向键选择、Enter 插入空格填充链接、单一候选直接插入。
- 前缀匹配零填充感知（BACK-01 ≡ BACK-1）；规范碰撞按 fail-closed 排除。
- wiki 路径按字典序前缀匹配并带逐候选负缓存。
- autocomplete 查找是独立只读前缀查询——不改 list 端点排序、参数或分页。
- 未保存编辑守卫覆盖离开模态框前的 chips 与自动链接。

## Related Concepts

- [[concepts/wikilink]] — 既有 wiki 链接语法，与裸 ID 自动链接互补。
- [[concepts/task-identity]] — 两侧共享的规范 ID 解析、零填充与碰撞处理。
- [[concepts/web-ui-features]] — 链接器与补全接入的 markdown 展示/编辑面。

## Related Sources

- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — 本任务裸 ID 链接所互补的 wiki 侧链接处理。
