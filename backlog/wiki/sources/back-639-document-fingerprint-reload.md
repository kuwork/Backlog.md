---
title: BACK-639 - 按正文指纹变化重载打开文档
labels: [source, web-ui, documents, live-refresh]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-639 - Reload-an-open-document-only-when-its-body-fingerprint-changes.md
---

# BACK-639 - 按正文指纹变化重载打开文档

Web 查看器忽略外部编辑直到手动重载：BACK-637 的 `handledRouteIdRef` 守卫只看路由 id，把真实正文编辑与无关刷新一起压掉了。本任务给每个文档一个正文指纹，打开的查看器只在文本真的变化时才重载。

- 新 `src/utils/content-fingerprint.ts`：零依赖指纹（长度 + 32 位 FNV-1a 哈希），纯函数，Bun 与浏览器双端可跑
- `parseDocument` 在每次读取时盖上 `contentHash`；在 `Document` 类型上标注为读取派生状态、从不序列化——`markdown.test.ts` 断言 `serializeDocument` 输出不含 `contentHash`
- `/api/docs` 携带指纹，重载决策不花额外请求
- `DocumentationDetail`：新 effect 比较到达的指纹与屏上正文，不同才静默重载——`loadDocContent` 新增 `{silent}` 路径，保持 DOM 挂载使滚动位置与哈希锚存活；跳过编辑模式，静默刷新失败保留当前正文，路由变化后才完成的拉取被丢弃
- BACK-637 的路由守卫保留：指纹 effect 与它并存而非取代，无关刷新仍永不重挂载正文
- 实测：在盘上编辑 `doc-12` 经 websocket 刷新了已打开的 `/documentation/12` 页面，无需手动重载；未变化的刷新不打扰页面
- 已知不相关：全量 bun test 套件在此 Windows 主机上很慢；剩余失败是超过 5s 预算的 CLI-spawn 测试与一个 Windows 临时目录 EBUSY 抖动

## 验收标准

- 文档载荷携带稳定的正文指纹，永不落盘到 markdown
- 外部编辑刷新打开的文档无需手动重载；未变化的刷新既不重载也不重新进入加载态
- 编辑模式缓冲区永不被覆盖；路由切换后的过期拉取被丢弃
- 测试覆盖正文变化重载、未变化刷新守卫与 BACK-637 锚点保留

## Related Concepts

- [[concepts/browser-loading]] — Web 详情页的刷新守卫与静默重载模式
- [[concepts/web-server]] — 驱动 docs 数组重建的 websocket `tasks-updated` 广播
- [[concepts/markdown-pipeline]] — 解析期派生状态保持在序列化之外

## Related Sources

- [[sources/back-637-hash-anchors-on-load]] — 引入本任务细化的路由 id 守卫
- [[sources/back-540-content-store-stale-refresh-guard]] — 喂给广播的服务器端内容存储变更检测
- [[sources/back-595-content-store-watcher-retry-rename]] — 同一刷新路径上的监视器健壮性
