---
title: 文档/决策身份歧义立即 Fail-Closed
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# 文档/决策身份歧义立即 Fail-Closed

## 背景

BACK-596/598 处理文档/决策实体的身份歧义：当裸 ID 对应多个实体（如 ID 同时命中路径与 slug 的不同实体）时，继续猜测可能操作错误的文件。

## 决定

身份歧义立即 fail-closed：

- CLI 退出码 1
- 服务器返回 409
- MCP 返回 `AMBIGUOUS_ID`
- Web 弹出共享通知提示歧义

裸 ID 歧义抛出后，绝不靠后续路径/slug 趟次救回——身份语义优先于可用性。歧义错误附带 ready-to-run 候选提示，作为纯增量的 stderr 输出。

## 理由

- 在歧义上"继续猜"可能把更新写到错误的文档上，fail-closed 把选择权交还用户。
- 身份语义优先于可用性：宁可这次操作失败，也不破坏 ID → 实体映射的可信度。
- 候选提示作为纯增量 stderr 不干扰机器可解析的输出，用户复制候选命令即可继续。

## 被否方案

- **歧义后退回路径/slug 趟次解析**：掩盖了 ID 唯一性被破坏的事实，且可能静默命中错误实体。

## Related

- [[sources/back-596-fail-closed-document-decision-identity]]
- [[sources/back-598-doc-view-disambiguate-path-title-slug]]
- [[concepts/task-identity]]
- [[concepts/mcp-workflow]]
