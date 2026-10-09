---
title: 'BACK-762 - Surface terminal statuses explicitly and stop editing them in settings'
labels:
  - source
  - config
  - web-ui
  - cli
created_date: '2026-10-09 22:00'
updated_date: '2026-10-09 22:00'
source_path: backlog/tasks/back-762 - Surface-terminal-statuses-explicitly-and-stop-editing-them-in-settings.md
---

# Surface terminal statuses explicitly and stop editing them in settings

终态集此前"读取路径不可见、设置页可误编辑"：`config list --plain` 只打 statuses 名字列表，`/api/statuses` 返回无 category 的裸数组，判断是否完成得打开 config.yml 逐行读 category；同时设置页的 "terminal status" 多选悄悄改写各列的 `category`（选中置 `done`+`exit: complete`、未选中重置 `active`），与状态机编辑器写同一字段——两个入口写一个字段，"terminal statuses 设置"这个不存在的概念被当真。

**读取路径全部显式化**：

- `backlog config list` 在 statuses 行后打印 `terminalStatuses: [Done, Dropped] (derived from statuses)`（`getTerminalStatuses` 派生，后缀防误当作可设键）；help-schema `output` 同步（该文本会被注入 AI 指引）
- `GET /api/config` 返回 `{ ...config, terminalStatuses }`——用 spread 而非挂在 config 上，因为 `handleUpdateConfig` 把收到的对象整体交给 `saveConfig`，挂 config 上会让客户端把派生值种进 config.yml
- `GET /api/statuses` 从 `string[]` 扩为 `{ statuses, terminalStatuses, defaultStatus }`（`defaultStatus` 回退机器 `initialStatus()` 再到首列；设置了 `default_status` 时它恒赢）；legacy 字符串数组机器仍只报末位列
- 前端 `fetchStatuses()` 两种形状都接受，下游零改动

**设置页停止做编辑器**：多选删除，换成只读区块展示集合（或译后的"无"）+ 一行说明"来自各列 category、在状态机编辑器中修改"；`handleTerminalStatusesChange` 与 `asStatusDefinitions` 连同独占 import 一并删除。状态机编辑器成为终态的唯一写入口。

**派生值绝不落盘**：`serializeConfig` 只写认识的键，未知字段过不了保存；测试把 `/api/config` 返回体原样 POST 回去，断言读回的 config.yml 没有 `terminalStatuses`。`src/guidelines/cli-instructions/overview.md` 同步：agent 首轮加载实况时读解析后的终态列表，而非猜名字或列位置。

## Related Concepts

- [[concepts/state-machine]] — category 派生终态的语义源头
- [[concepts/cli-entry]] — config list 输出
- [[concepts/web-server]] — /api/config 与 /api/statuses 形状
- [[concepts/web-ui-features]] — 设置页只读区块

## Related Sources

- [[sources/back-761-terminal-card-actual-end]] — 终态集的 Web 消费面（同批）
- [[sources/back-715-state-machine-editor-settings]] — 状态机编辑器（终态唯一写入口）
- [[sources/doc-17-state-machine-semantics-diagnosis]] — category 六类模型
