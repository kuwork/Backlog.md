---
title: 终态集是派生值：读取路径显式呈现、绝不落盘、唯一写入口是状态机编辑器
labels: [decision, state-machine, config, web-ui, cli]
created_date: '2026-10-09 22:00'
updated_date: '2026-10-09 22:00'
---

# 终态集是派生值：读取路径显式呈现、绝不落盘、唯一写入口是状态机编辑器

## 决策内容

BACK-762："哪些列是终态"是从各状态 `category` 派生的值（`getTerminalStatuses`），不是配置键。所有读取路径（`config list`、`GET /api/config`、`GET /api/statuses`）显式输出它；它绝不写回 `backlog/config.yml`；设置页不再能编辑它，唯一写入口是状态机编辑器的 category 编辑。

## 背景

此前终态集"读取路径不可见、设置页可误编辑"：`config list` 只打名字列表，`/api/statuses` 返回无 category 的裸数组，判断是否完成要打开 config.yml 逐行读；与此同时设置页的 "terminal status" 多选并不存储任何列表，而是改写各列 `category`（选中置 done+exit:complete、未选中重置 active）——与状态机编辑器写同一字段，"terminal statuses 设置"这个不存在的概念被两个控件坐实。

## 拒绝方案

- **保留设置页多选作为快捷入口**：两个控件写一个字段，概念持续失真；且多选把 category 的其他语义（dropped 与 done 不同 exit）压平成布尔
- **把终态集存成独立配置键**：与 category 双写，必然漂移；dropped/自定义终态的 exit 语义无法表达
- **派生值挂到 /api/config 的 config 对象上返回**：`handleUpdateConfig` 把收到的对象整体 `saveConfig`，客户端一次回存就把派生值种进 config.yml

## 采纳方案

- 读取面全部显式化：`config list` 打 `terminalStatuses: [...] (derived from statuses)`（后缀防误设）；`/api/config` 用 spread 附带；`/api/statuses` 扩为 `{ statuses, terminalStatuses, defaultStatus }`，前端兼容旧 `string[]` 形状
- 写面收敛到一处：设置页多选删除换只读区块，状态机编辑器是唯一写入口
- 防落盘双保险：`serializeConfig` 只写认识的键 + 测试把 API 返回体原样 POST 回去断言无 `terminalStatuses`
- AI 指引同步：agent 首轮读 `config list` 的派生行判终态，不猜名字或列位置

## Related Sources

- [[sources/back-762-terminal-statuses-readonly]] — 本决策的实现任务
- [[sources/back-761-terminal-card-actual-end]] — 终态集的消费面与判定 API 分层
- [[sources/back-715-state-machine-editor-settings]] — 唯一写入口
