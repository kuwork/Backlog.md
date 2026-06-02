---
title: Wiki 浏览与编辑
labels: [usermanual]
created_date: 2026-05-14 00:00
---


# Wiki 浏览与编辑

Backlog.md 的 Web 界面提供完整的 Wiki 模块，用于浏览和编辑 `backlog/wiki/` 目录下的知识库内容。Wiki 是 **LLM 维护的增量式知识库** — AI 代理读取 tasks/docs/decisions 等源文件，自动编译为结构化 wiki 内容；人类可读可编辑，也可直接创建和修改页面。

## 进入 Wiki

启动 Web 界面后，点击顶部导航栏的「Wiki」标签，进入 Wiki 页面。页面分为左右两部分：

- **左侧边栏**：可折叠的文件树，反映 `backlog/wiki/` 的目录结构
- **右侧内容区**：渲染后的 Markdown 内容

## 浏览文件树

侧边栏以树形结构展示 `backlog/wiki/` 的全部内容：

- 点击文件夹左侧的 Chevron 图标展开或折叠
- 文件夹名称右侧显示该目录下的 Markdown 文件数量（如 `concepts (3)`）
- 点击 `.md` 文件即可在右侧查看内容
- 空文件夹也会显示在树中，可展开查看其子内容

### 路径与 URL

Wiki 页面的 URL 保持目录层级的可读性，`/` 分隔符不会被编码为 `%2F`。例如位于 `concepts/web-ui-features.md` 的页面，地址栏显示为：

```
http://localhost:6420/wiki/concepts/web-ui-features
```

路径中的空格、中文等特殊字符会被安全编码，但目录层级始终直观可辨。你可以直接复制或修改地址栏中的路径来快速跳转目标页面。

## 查看页面内容

Wiki 页面以渲染后的 Markdown 格式展示：

- 从 frontmatter 中提取并显示页面标题
- 支持代码块语法高亮、Mermaid 图表、表格、列表
- **Labels 标签**：页面标题下方显示该页面的 labels 标签（如 `concept`、`source`）
- 点击正文中的 `[[wikilink]]` 可跳转到对应页面

## 在线编辑

点击页面右上角的「Edit」按钮进入编辑模式：

- **标题**：在顶部大输入框中修改页面标题，保存后自动写入 frontmatter
- **Labels**：标题下方的 ChipInput 支持添加/删除标签；按 Enter 或逗号添加，Backspace 删除最后一个
- **正文**：使用完整的 Markdown 编辑器（支持粘贴为 Markdown、图片上传、Word 文档转换）
- **保存**：只有内容、标题或 labels 发生变更时，Save 按钮才变为蓝色可用状态
- **取消**：点击 Cancel 放弃所有修改，恢复原始内容

保存后，页面 frontmatter 会自动更新 `updated_date` 字段。

## 创建文件与文件夹

在侧边栏的任意位置创建新内容：

1. 将鼠标悬停在文件夹名称或 Wiki 根标题上
2. 右侧会出现 `+` 按钮，点击展开下拉菜单：
   - **Create file** — 创建新页面，输入文件名（自动补全 `.md`）
   - **Create folder** — 创建空文件夹
3. 创建成功后自动导航到新页面

根标题「Wiki」上的 `+` 按钮用于在 `backlog/wiki/` 根目录下创建内容。

## 重命名

在文件或文件夹的下拉菜单中选择 **Rename**：

- 输入新名称，支持跨目录移动（如 `concepts/new-name`）
- 如果当前正在查看该页面，重命名后会自动导航到新路径

## 实时同步

Wiki 内容在所有打开的标签页中实时同步：

- 通过 CLI 或外部编辑器修改 wiki 文件 → WebSocket 广播 → 所有浏览器标签自动刷新
- 在浏览器中编辑保存 → 其他标签页即时显示更新
- 文件树也会自动响应创建、修改、删除、重命名等操作

## 与文档的区别

| | 文档 (docs/) | Wiki (wiki/) |
|---|---|---|
| **维护者** | 人工编写 | 主要由 AI Skill 维护，人类可读可编辑 |
| **用途** | 项目指南、API 文档、参考手册 | 知识库：概念提取、来源摘要、交叉引用 |
| **编辑** | 创建后通过编辑器修改 | 浏览器中直接编辑，frontmatter 自动管理 |
| **结构** | 人工组织 | AI 维护标准目录（`sources/`、`concepts/`、`entities/`） |
