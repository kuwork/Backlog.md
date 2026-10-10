---
title: BACK-640 - 修复 Mermaid 图表不渲染（三处）
labels: [source, web-ui, mermaid, markdown]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-640 - Fix-Mermaid-diagrams-not-rendering-fence-case-app-theme-and-editor-preview-panes.md
---

# BACK-640 - 修复 Mermaid 图表不渲染（三处）

Mermaid 围栏块在同一 Web 渲染管线中以三种互不相同的方式失败，针对 doc-17 报告那里图表根本没出现：区分大小写的类选择器错过 `Mermaid` 围栏，图表无视应用配色模式，markdown 编辑器的 Live/Preview 窗格从不渲染图表。

- 大小写修复：`renderMermaidIn` 用 CSS 选择器 `pre > code.language-mermaid` 定位块，但管线把围栏 info 字符串原样传进类名而类选择器区分大小写——`Mermaid` 围栏匹配零节点，函数在加载 mermaid 前就返回；匹配现在用 `classList` 小写比较遍历，导出为两条渲染路径共享的 `hasMermaidLanguageClass`
- 主题修复：mermaid 曾以主题 `default` 初始化一次；`renderMermaidIn` 现在接受 `{ mode }` 与 `MERMAID_THEME_BY_MODE`（light → default，dark → dark），并按模式键控重新初始化，因为 mermaid 全局保留配置；MermaidMarkdown 把 `MDEditor.Markdown` 子树键控在模式上，主题切换时稳定重渲染
- 编辑器修复：编辑器窗格自己渲染 markdown、不走 MermaidMarkdown；`previewOptions.components.pre` 覆盖（`MermaidAwarePre`，在新 `MermaidDiagram.tsx` 中）把 mermaid 块换成 `MermaidDiagram` 元素，不必动每个调用点
- 两个渲染入口有意并存并共享 `renderDiagram`：`renderMermaidIn` 替换调用方不拥有的 DOM 中的 `pre` 节点，而 `MermaidDiagram` 填充 React 拥有的、留空的容器，React 永不调和不是它创建的子节点
- 仅预览窗格塌成约 20px 条带，因为 MDEditor 以 `height:100%` 对着 auto-height 容器定尺寸；容器现在 `h-full`（Edit/Live 模式因 textarea 提供高度而掩盖了此问题）
- 记录验证注意事项：Web bundle 在服务器启动时构建，前端检查需要重启服务器，且复用的 Chrome 配置文件缓存旧 bundle
- 测试：扩展 `mermaid.test.ts`（大小写不敏感匹配、主题映射、按模式键控重初始化），新 `mermaid-preview.test.tsx`；在真实浏览器双主题下跨阅读视图与全部三个编辑器窗格确认

## 验收标准

- `Mermaid`/`MERMAID` 围栏渲染为图表，与 `mermaid` 相同；非 mermaid 围栏在所有地方保持纯代码
- 阅读视图以匹配应用配色模式的 mermaid 主题渲染图表
- 编辑器 Live 代码与 Preview 代码窗格渲染图表，仅预览窗格保持确定高度

## Related Concepts

- [[concepts/markdown-pipeline]] — 围栏 info 字符串原样流入类名
- [[concepts/web-ui-features]] — MermaidMarkdown 渲染器与编辑器预览界面
- [[concepts/tui-theme-adaptive]] — 同类主题感知工作（TUI 侧）

## Related Sources

- [[sources/back-611-mermaid-anchor-href-pathname-prefix]] — 同一管线中的早期 mermaid 链接修复
- [[sources/back-626-dependabot-mermaid-bump]] — mermaid 依赖版本背景
