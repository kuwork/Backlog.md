---
title: BACK-841 - 补齐语料摘要首载与广播抖动缺口
labels: [source, web-ui, server, performance]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/tasks/back-841 - Close-corpus-digest-gaps-on-first-load-and-broadcast-jitter.md
---

# BACK-841 - 补齐语料摘要首载与广播抖动缺口

BACK-840 上线后，一次编辑仍可能产生两次 `/api/search`。两个缺口都在服务端：

1. **WebSocket open 只发 `browserLoadingState`，不发 `corpus-state`** —— `serverCorpusDigestRef` 直到第一条 data-change 广播才建立，因此每次编辑后的刷新都 fail-open，永远无法被跳过。
2. **广播摘要在 300ms 合并窗口末尾采样，而 `/api/search` 摘要在搜索读快照后采样** —— 进程内 upsert、逐文件 watcher、周期重扫会在数秒内改变 ContentStore，两个摘要可能不同（浏览器里观察到的 D1→D2→D1 抖动），post-broadcast 跳过判定随之失败。

## 修复

- WebSocket open 在 `ensureServicesReady` 解析后（ContentStore 非空）补发一条 `corpus-state`，客户端连上即播种 `serverCorpusDigestRef`。
- `broadcastDataUpdated` 改为在**合并窗口开始**时（触发变更已落入 ContentStore）采样一次摘要，并在整个窗口内复用该值，不再窗口末尾重算，使广播摘要与编辑后 `/api/search` 读到的快照一致。

纯字符串广播完全不变，忽略 `corpus-state` 的旧构建行为无回归。窗口起始采样对合并了多次编辑的窗口也是安全的：最多只是 fail-open 多刷新一次，绝不会跳过真实变更。

## 验证

`tsc --noEmit`、Biome 干净；server + digest 套件 195 个测试通过，新增两条：连接时摘要播种、广播摘要 == 变更后 `/api/search` 摘要。该轮 5 个失败测试为既有环境问题（干净树上的 Bun segfault、端口/HTML shell 超时），通过在未修改代码上复跑确认与本变更无关。

## Related Concepts

- [[concepts/corpus-digest]] — 连接播种与窗口起始采样
- [[concepts/web-server]] — WebSocket 消息序列

## Related Sources

- [[sources/back-840-corpus-digest-refresh-skip]] — L1 主体
- [[sources/back-843-browser-startup-cache]] — 连接时摘要播种依赖 services ready 时序
