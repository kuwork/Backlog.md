---
title: Memo 归档用 verbatim rename 而非重写
labels: [decision, memos, core]
created_date: '2026-10-05 08:25'
updated_date: '2026-10-05 08:25'
---

# Memo 归档用 verbatim rename 而非重写

## 决策内容

BACK-747 的归档是 `backlog/memos/<id>.md` → `backlog/archive/memos/<id>.md` 的**逐字节 rename**：不碰 frontmatter、不重写正文、不改 id 与日期；未知 id 返回 false，目标已存在返回 null 拒绝覆盖（REST 层对应 404 / 409）。

## 背景

归档要满足两点：归档后笔记从所有活跃列表（feed、日历、标签过滤、钉板）消失；动作要可逆。两条路：rename（移动文件）或 rewrite（读出内容、写入新文件、删旧文件）。

## 拒绝方案

- **读出-重写-删除**：引入内容被意外改变的窗口（frontmatter 规范化、换行符、编码），git 记录为删除+新增而非 rename，历史不可追
- **覆盖已存在的归档目标**：同名 id 意味着语料异常，静默覆盖会毁掉既有归档

## 采纳方案

- `fs rename` 原样移动，git 视为 rename，移动天然可逆
- 冲突显式报告（409），把语料异常暴露给调用方
- **不做取消归档**：UI 无反向动作、无归档视图、不列归档笔记；因文件除了位置毫无变化，将来加 unarchive 不需要迁移

## Related Sources

- [[sources/back-747-memo-archiving]] — 本决策的实现任务
- [[sources/back-728-memo-storage-layer]] — memo 文件格式与 IO 归属
