---
title: 相对引用采用渲染期 join 加服务端 try_files 两阶段解析
labels: [decision, markdown, web-ui, core, server, m-19]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
---

# 相对引用采用渲染期 join 加服务端 try_files 两阶段解析

## 背景

BACK-835 之前，Web Markdown、文件预览 API、wiki 层对同一个本地路径各按各的基准解析，导致数据目录的兄弟目录（`src/`、`quickstart/`、`scripts/`）里的 Markdown、代码、图片与 Office 二进制无法预览。

## 决定

拆成两阶段，且明确各阶段的职责边界：

1. **渲染期**：每个本地 `href`/`src` 与当前文档所在目录 join，结果作为站点绝对 URL 直接写进 HTML 标签。
2. **服务端**：注册路由优先，未命中的 GET 落到唯一一个 nginx 风格 `try_files` 处理器，按「项目根 → 配置数据目录 → 其 assets」有序候选表返回第一个存在的文件。

以 `/` 开头的目标归 URL / 路由层，**永不 join**。包含边界是**项目根**而非数据目录，多级 `../` 只要仍在根内就允许。路径解析、包含判定、文件 IO、大小限制、目录拒绝全部下沉到 `src/file-system`，server handler 只适配 HTTP 输入与状态码。

## 被否方案与代价

| 替代 | 为什么否 |
|---|---|
| 在每个 UI 组件里各自拼路径 | 正是现状的病因；基准分散在浏览器、API、wiki 三处，修一处漏两处 |
| 让服务端从 `Referer` / 请求上下文反推文档目录 | 弹窗内嵌套预览、SPA 路由、刷新直达都会丢失上下文，且无法在渲染期决定锚点是否可点 |
| 把边界设为数据目录，正文只允许 `assets/...` | BACK-827 的旧契约；无法满足「与数据目录同级的兄弟目录也可预览」这一需求，且迫使内容迁移 |
| 在渲染期做真实文件存在性检查 | 渲染层不该碰磁盘 IO，也无法覆盖自定义数据目录与后续写入的文件；存在性交给服务端候选表 |
| 用 `startsWith` 做包含判定 | 前缀碰撞与符号链接可绕过；改用 `relative()` + `isAbsolute()` 并校验 realpath |
| 给正文链接统一加 `backlog/` 前缀 | 会引入新的硬编码前缀、破坏自定义数据目录名，且与元数据字段的项目根相对语义混淆 |

## 关键约束（后续改动易破）

- **元数据与正文分道**：`--ref`/`references`、`modifiedFiles`、文档路径、查询块 `source` 始终项目根相对；只有正文 href/src 按所在文档 join。混同两者是最常见的回归。
- 集合内相对路径必须在 API 边界派生 `projectPath`（decision 甚至是裸文件名、wiki 需额外 `wikiRoot`），存储值不变。BACK-836/837 的死 `#` 锚点就是缺这一步。
- 纯字符串 WebSocket 广播、旧客户端行为、既有 `assets/...` 与 `/assets/paste/...` 链接均不得破坏（同类「保留旧通路」的取舍也出现在 [[decisions/corpus-digest-over-event-version]]）。

## 验证证据

45 个测试覆盖渲染 HTML、路由优先级、候选顺序、项目根逃逸、多级父目录、编码文件名、自定义数据目录、跨目录 Office 预览、敏感/超大文件拒绝；doc-34 四条链接在查看态解析到真实路径、编辑态四条全蓝。BACK-836/837 再以 decision-2 与 wiki 验收页做 CDP 点击对照。

## Related Concepts

- [[concepts/relative-reference-resolution]] — 完整契约
- [[concepts/file-preview]] / [[concepts/web-server]] — 两个使用方

## Related Sources

- [[sources/back-835-unify-relative-reference-resolution]] — 裁决与 Implementation Notes
- [[sources/back-836-decision-relative-reference-resolution]] — 边界转换推广
- [[sources/back-837-wiki-relative-references-entity-links]] — wikiRoot 分流
- [[sources/back-827-project-wide-docx-pdf-preview]] — 被取代的旧契约
