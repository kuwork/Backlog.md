---
title: BACK-818 - 看板弹窗清单批量保存 + 服务端广播防抖加宽
labels: [source, web-ui, core, server]
created_date: 2026-10-23 17:20
updated_date: 2026-10-23 17:20
source_path: backlog/tasks/back-818 - Batch-web-checklist-toggles-and-widen-server-broadcast-debounce.md
---

# BACK-818 - 看板弹窗清单批量保存 + 服务端广播防抖加宽

围绕看板任务弹窗验收清单的两处请求/广播放大修复。

## 问题

1. **服务端**：一次任务文件写入经三条独立路径进入 ContentStore（进程内文件系统补丁、逐文件 watcher、根 watcher 重扫），各自发出的 tasks 通知相隔 >75ms，75ms 广播防抖无法合并——一次 Web 编辑扇出 2–3 条 `tasks-updated` WS 消息，每条都让客户端重拉 `/api/search`（实测一次勾选触发 3–4 次 GET）。
2. **Web 弹窗**：预览态每个验收清单勾选立即发一次 PUT；连续勾选（如过一遍 AC 列表）每次点击都发请求并触发广播刷新。

## 改了什么

| 文件 | 作用 |
|---|---|
| `src/server/index.ts` | 广播防抖 75ms → 300ms（`BacklogServer.DATA_BROADCAST_DEBOUNCE_MS`，命名常量），更新过期注释 |
| `src/web/components/TaskDetailsModal.tsx` | 预览态 AC/DoD 勾选改为乐观更新，用户停顿 1000ms（`CHECKLIST_SAVE_DEBOUNCE_MS`，导出常量）后合并为一次 PUT：AC 发整数组、DoD 发批量勾/消索引操作（只发每个索引最终态）；弹窗卸载时 flush 待保存；失败回滚到服务器已知状态 |
| `src/test/web-task-details-modal-checklist-debounce.test.tsx` | 突发合并 + 卸载 flush 回归测试 |

实测调优：用户确认 3000ms 批处理可行，最终定为 1000ms。排查同时确认周期性重扫（BACK-815）不是请求风暴源（75s 空闲监听零广播，静默 WS 撑过 200s 未断）。

## Related Concepts

- [[concepts/web-server]] — 广播防抖与内容实体 scope
- [[concepts/web-ui-features]] — 任务详情弹窗与清单交互

## Related Sources

- [[sources/back-815-server-cache-self-heal]] — 同波的服务端缓存自愈
- [[sources/back-568-core-browser-task-boundary]] — 早期 75ms 广播防抖与 reorder 原子应用
