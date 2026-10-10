---
title: 产物面目录统一解析点 resolveBacklogDirectory()
labels: [decision, core, config, memos, graph]
created_date: 2026-10-09 22:00
updated_date: 2026-10-09 23:30
---

# 产物面目录统一解析点 resolveBacklogDirectory()

## 背景

`backlog-dir` 配置（`.backlog` / 自定义路径）落地后，memo 存储与图谱扫描两处仍把目录名硬编码成 `"backlog"`：`.backlog` 项目 watcher 启动即 ENOENT、memo 读写落错目录、任务/知识图谱为空。两处都是"最后一个没接入统一解析的产物面"，且各自带一个回归用例（`.backlog` 种子项目）锁定。

## 决定

BACK-757/758：tasks/docs/decisions/memos/graph 每一个产物面的目录解析都必须走 `resolveBacklogDirectory()` 这一既有单一解析点，未配置时回退 `DEFAULT_DIRECTORIES.BACKLOG`；memo 这类纯模块直接调用解析函数，而不是为了拿目录去 threading 一个 filesystem 实例。

采纳要点：

- `resolveBacklogDirectory()` 是唯一事实来源，新产物面落地时接解析函数是验收的一部分
- 未初始化项目（解析返回 null）统一回退 `backlog`，默认行为不变
- 每处修复配 `.backlog` 种子回归用例，防默认目录 fixture 掩盖缺陷（同 BACK-759 前缀 fixture 的教训）

## 被否方案

- **给 memo 模块传入 filesystem 实例拿 `getBacklogDir()`**：memo 是纯函数式存储模块，为一个目录名引入实例依赖不划算；解析函数本身无状态，直接调用与全仓其余消费方一致
- **每处写自己的发现逻辑**（探测 `.backlog` 存在与否）：必然再次漂移，BACK-757/758 正是这种漂移的代价
- **只修报错的 watcher 一处**：memo 读写与 watcher 同源，且同族硬编码在图谱面同步存在，单点修复会留下下一个 bug

## Related Sources

- [[sources/back-757-memo-backlog-dir-resolution]] — memo 面修复
- [[sources/back-758-graph-backlog-dir-resolution]] — 图谱面修复
