---
title: BACK-658 - JSON 读取路径发布就绪状态
labels: [source, cli, json-output, readiness, upstream-migration]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-658 - Publish-task-readiness-in-the-JSON-read-paths.md
---

# BACK-658 - JSON 读取路径发布就绪状态

`task list --json`、`search --json` 与 `task view --json` 对就绪状态只字未提，尽管 CLI 早已通过 `--ready` 按它过滤；JSON 消费方不得不重新实现依赖遍历，或对每个候选 shell 出去。本任务把判定结果发布进负载，读取时从现有就绪引擎推导，绝不存储。

- `src/utils/readiness.ts` 新增 `TaskListItem`（`Task & { isReady }`）与 `withReadiness(tasks, graph)`：从调用方已加载的语料一次性构建就绪索引，再把整个列表映射上去——列表读取保持线性，而不是逐行解析依赖
- `src/formatters/json-output.ts` 中的紧凑任务摘要（任务列表与 search 共用）新增 `isReady`；`task view --json` 增加 `readiness` 块，含 `isReady`、`isBlocked`、`blockingDependencies` 与 `missingDependencies`，来自同一推导
- 任务列表：`--ready` 以前就地过滤，而 `--json` 序列化的是新切的一份，两者可能不一致；现在任一 flag 要求就绪时行只投影一次，过滤器在该投影的判定上运行，JSON 序列化的正是过滤器放行的行
- Search 在写负载时把判定挂到为它读取的那条记录上，绝不按任务 ID 重新连接——两个文件争抢一个身份时各保有自己的答案；completed 语料最多加载一次，无任务的结果集完全不加载
- 刻意不动：`loadReadinessGraph` 及其四个既有调用方、算法本身、空结果文案 `No tasks found.`（另一处分歧另行处理）
- 测试：`withReadiness` 单元用例，外加三个 JSON 面上的判定发布与跨面一致、completed 语料、配置终态输入；每个新用例都先对未改动代码确认变红

## 验收标准

- `task list --json` 在每个摘要上发布 `isReady`，由整个可见语料推导
- `--ready --json` 序列化它据以筛选的判定，一次语料扫描完成
- `search --json` 每条记录携带判定，不按 ID 重新连接
- `task view --json` 在 `isReady` 旁发布 `readiness`（阻塞项与缺失依赖）
- 既不按判定过滤也不发布判定的读取不加载任何 completed 语料

## Related Concepts

- [[concepts/json-output]] — 新增 `isReady` 的紧凑任务摘要
- [[concepts/task-lifecycle]] — 依赖状态上的就绪判定
- [[concepts/upstream-migration]] — 移植自上游 BACK-672（f1c14f6a9）

## Related Sources

- [[sources/back-615-dependency-readiness-guidance]] — 本任务发布判定所依赖的就绪引擎
- [[sources/back-657-task-list-json-watch]] — 监视帧携带本任务的 `isReady` 字段
- [[sources/back-625-ac-progress-json-output]] — 兄弟 JSON 发布任务
