---
title: BACK-709 - 任务语料的依赖闭包与跳数查询
labels: [source, dependencies, web-ui, api]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-709 - Answer-dependency-closure-and-hop-counts-from-the-task-corpus.md
---

# BACK-709 - 任务语料的依赖闭包与跳数查询

一个查询回答任何界面都答不了的三个依赖问题：一个任务传递依赖什么、距离多远，什么传递依赖它，以及哪个未完成任务是真正的根阻塞——外加遍历必须曝光的悬空/歧义引用与环。以 `GET /api/task/:id/dependencies` 暴露，并在任务详情模态框中渲染。

## 实现要点

- 语料决策（2026-09-24）：从本地语料（tasks + completed）回答，绝不来自 graph service——默认后端是纯 JS map（kuzu 在 Bun 下会 segfault），GraphStore 没有多跳调用，且只有 web 宿主启动该服务；对 CLI、TUI、MCP 和 web 来说，磁盘记录上的遍历是唯一且最便宜的路径
- `src/utils/dependency-closure.ts` 扩展（而非替换）：反向索引 `dependentsOf`、`closureFrom`（BFS，每个任务一行、取其最短跳数，按跳数再按 id 排序）、`cycleThrough`；visited 集合给环言语料定界，再次到达主体被报告为环而非错误；未解析引用随结果同行返回
- `DependencyQuery`（`src/utils/dependency-query.ts`）按请求回答 `answer()`/`answerBoth()`；主体标识走门卫的 `matchRecords` 规则解析——早期的 `canonicalTaskId` map 查找会把 `back` 前缀项目中的 "414" 读成 TASK-414，并在两条冲突记录中默默保留后一条
- 测试中断言的语料规则：completed 目录即完成证据、milestone 排除、draft 单向游走（可依赖任务、被点名时可作主体，但绝不作为依赖返回；无 ask 标志时 draft 主体回答 `null` 而非空闭包）
- 端点：一个请求回答双向（含跳数）、阻塞者、环、未解析引用与语料摘要；未知主体 404，maxHops 畸形 400；PUT 处理程序现在给门卫拒绝附上机器可读的 `code` + `detail`（dependency_cycle / self_dependent / ineligible_target），客户端可本地化
- 模态框（随 BACK-710 提交落地）：每次打开拉取一次，每次 settled 的内联编辑拉取一次（`finally` tick，绝不基于乐观状态——移除时刻的重拉会重新报告刚移除的环），外部 `tasksVersion` 刷新时也拉取；答案经运行时形状检查，渲染 "Waits for" / "Waited on by" 行（含跳数）、高亮根阻塞者、环与未解析引用；被拒绝的编辑回滚乐观芯片并显示本地化原因，6 秒后自动消失
- fork 原生工作：上游不带图数据库；Kuzu 图谱只服务于可视化。测试：dependency-closure 14、服务端端点 3、模态框 6；在 BACK-495.3 和 BACK-218 上浏览器验证

## 验收标准

- 每个宿主都仅从语料回答；draft 绝不作为依赖返回；每个任务一行、顺序稳定、取最短跳数；菱形去重
- 反向闭包与根阻塞者可识别；未解析引用被露出；环言语料可终止并标记环
- Web 界面每次弹层打开从一个请求渲染正向/反向/跳数，不轮询

## Related Concepts

- [[concepts/web-ui-features]] — 本任务扩展的任务模态框依赖 UX
- [[concepts/web-server]] — 托管新端点
- [[concepts/task-lifecycle]] — completed 目录即证据的语料规则

## Related Sources

- [[sources/back-707-dependency-gate-cycles]] — 共享遍历与语料定义的写入门卫（同一批）
- [[sources/back-708-doctor-dependency-defects]] — 同一语料遍历上的 doctor 报告（同一批）
- [[sources/back-710-task-modal-relationship-graph]] — 依赖的兄弟模态框界面（同一批）
- [[sources/back-615-dependency-readiness-guidance]] — 阻塞者识别所镜像的 readiness 语义
