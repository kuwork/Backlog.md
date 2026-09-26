---
title: 唯一 sanitizeFilename 内做 untitled 回退
description: BACK-650 在唯一的文件名净化函数里回退占位符，四个保存点全部继承
labels: [decision, core]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# 唯一 sanitizeFilename 内做 untitled 回退

## Context

纯标点标题（如 `!!!`）净化后得到空片段，产出 `back-42 - .md`。空片段本身能 round-trip，但 `<id> - ` 前缀对多个文件名读者是承重结构：任务 watcher 取首个空格前的 id、decision watcher 与 `task-path` 按 ` - ` 切分、文档保存按前缀去重、重复任务修复拒绝没有分隔符的路径。

## Decision

修在唯一的所有者里：`sanitizeFilename` 返回净化值或 `'untitled'`，四个调用点（saveTask/saveDraft/saveDecision/saveDocument）全部继承；frontmatter 里的标题保持 `!!!` 不动。文件名永远保持 `id - title.md` 形状，不引入 id-only 文件名。

## Rejected alternatives

- 在四个调用点各自判断空片段——四个机会漂移，且下一个新实体类型还会漏
- 允许 id-only 文件名——上述五个按分隔符读文件名的读者全部失效

## Related Sources

- [[sources/back-650-untitled-filename-fallback]] — 本决策的落地
- [[sources/back-642-draft-identity-fail-closed]] — 同一不变式保护的草稿身份
- [[sources/back-538-duplicate-task-id-recovery]] — 依赖分隔符的重复修复
