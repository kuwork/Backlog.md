---
title: 配置目录（backlog-dir）推广时的硬编码路径审计模式
labels: [execution, core, config, testing]
created_date: 2026-10-09 22:00
updated_date: 2026-10-09 23:30
extracted_from:
  - BACK-757
  - BACK-758
---

# 配置目录（backlog-dir）推广时的硬编码路径审计模式

引入"目录可配置"概念（`backlog-dir` / `backlog_directory`）后，把全部产物面接到统一解析点的审计流程，从 BACK-757（memo）/ BACK-758（graph）提炼。

## 标准步骤

1. **症状归族**：watcher 启动 ENOENT、某视图静默为空、读写"丢失"——先怀疑硬编码目录名，而不是数据本身（`.backlog` 项目下去找 `backlog/` 子路径必然落空）
2. **全仓 grep 字面量**：`join(root, "backlog"`、`DEFAULT_DIRECTORIES.BACKLOG` 的直接拼接点逐一列出，对照"应走 `resolveBacklogDirectory()`"的清单（tasks/docs/decisions/milestones/memos/graph）
3. **确认不受影响面**：图数据库等存全局缓存的产物（`graphPaths()`）从一开始就不依赖项目内目录，审计时显式排除并记录，避免误改
4. **纯模块直接调解析函数**：不要为拿目录名给纯模块 threading filesystem 实例——解析函数无状态，直接调用与全仓消费方一致
5. **未配置回退默认**：解析返回 null 时统一 `?? DEFAULT_DIRECTORIES.BACKLOG`，保持默认行为逐字节不变
6. **每处配 `.backlog` 种子回归用例**：种子 `.backlog/config.yml` + 最小语料，断言解析路径落在 `.backlog/` 下

## 常见陷阱

- **默认 fixture 掩盖缺陷**：测试 fixture 若用默认目录/默认前缀，缺陷会完美隐身（BACK-757 的 `backlog/config.yml` 种子、BACK-759 的 `task` 前缀 fixture 是同一教训的两个实例）——回归用例必须用非默认值
- **watcher 与读写同源不同修**：只修抛错的 watcher 会留下读写落错目录的第二个 bug，审计按"读/写/监听"三个动作逐面核对
- **re-init 不补建结构**：配置能力升级后，重跑 `init` 应幂等补建缺失目录（`ensureBacklogStructure`），否则升级路径断裂

## Related Sources

- [[sources/back-757-memo-backlog-dir-resolution]] — memo 面实例
- [[sources/back-758-graph-backlog-dir-resolution]] — 图谱面实例
