---
title: BACK-667 - 侧边栏文档树名称与 ID 排序开关
labels: [source, web-ui, sidebar, sorting]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-667 - Add-name-and-ID-sort-toggles-to-the-web-sidebar-document-tree.md
---

# BACK-667 - 侧边栏文档树名称与 ID 排序开关

侧边栏文档树渲染的是服务端原始文件系统顺序——Windows 上是文件名顺序，其他地方任意——不像按标题排序的平面文档列表。本任务给文档小节头部加 `Name`（标题）和 `ID` 排序开关，样式与任务列表头部排序按钮一致。

- 两个开关位于新建文档下拉左侧，镜像任务列表头部的标签 + `↑/↓` 指示器；标题升序为默认，点击未激活列从升序重启，点击激活列翻转方向
- `sortDocsTree(nodes, column, direction, docTitles)` 独立排序每个文件夹层级并返回新节点对象（`{ ...node, children: sorted }`）——prop 树永不被改动
- 文件夹永远在前（它们既无标题也无文档 ID）并按名称跟随当前方向；文件按所选列排序
- `Name` 比较行打印的标签——来自 memoized `docId → title` 映射的文档标题，回退到无扩展名的文件名——通过 `localeCompare(..., { numeric: true, sensitivity: "base" })`，所以 `doc-4` 排在 `doc-10` 前；同一个 `docsNodeLabel` 辅助函数也喂给行本身，顺序永远与显示一致
- `ID` 通过 `compareTaskIds` 比较 `node.docId`，标签作决胜；两列在该语料上确实意见不同（标题顺序 vs `doc-4 … doc-13`）
- 早期一版按文件名列排序，在 `doc-NN - title.md` 式名称上几乎等于 ID 顺序；用户要求改用标题
- 语言：`sortDocsByName`/`sortDocsById` 与提示进全部四本字典；6 用例 JSDOM 测试的 fixture 标题刻意与文件名无关；zh-CN 下经 CDP 实测验证并带回退探针

## 验收标准

- 两个排序按钮渲染在新建按钮左侧并带升降指示器，标题列默认激活升序
- 标题排序先文件夹后文件按标题排，两个方向都可用，自然数字序
- ID 排序按文档 ID 数字序排文件，文件夹按名称跟随；每个文件夹层级都被排序，prop 树不动
- 点击未激活列切到升序；点击激活列翻转
- 四种语言都带标签与 tooltip；测试用无关 fixture 标题区分两列

## Related Concepts
- [[concepts/web-ui-features]] — 侧边栏树与头部控件约定
- [[concepts/task-identity]] — 复用于文档 ID 的 `compareTaskIds` 数字 ID 排序
- [[concepts/web-ui-i18n]] — 四语言 key 一起落地（`TranslationDict` 由 en 推导）

## Related Sources
- [[sources/back-672-wiki-tree-sort-toggles]] — 直接把同模式应用到 wiki 树的后续（批次兄弟）
- [[sources/back-674-decisions-sort-toggles]] — 把本标签改名为 `Title` 并扩展到决策的后续（批次兄弟）
- [[sources/sidebar-resize-search-task]] — 早期侧边栏结构工作
