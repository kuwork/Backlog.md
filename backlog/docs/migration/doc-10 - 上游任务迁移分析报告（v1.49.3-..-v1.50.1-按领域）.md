---
id: doc-10
title: v1.49.3 至 v1.50.1 上游任务迁移分析报告（按领域）
type: guide
created_date: '2026-08-14'
updated_date: '2026-08-14'
---
# 上游任务迁移分析报告（v1.49.3 .. v1.50.1，按领域）

本报告对应 `doc-9` 中全部 A 类与 B 类条目，逐项分析上游任务核心目的、变更内容、与当前 fork 的交集风险、适合迁移的部分、需要调整/排除的部分、迁移优先级与建议。原始任务文件已作为 draft 导入 `backlog/drafts/`，通过 `DRAFT#N` 链接可查看（`/draft/N` 在 Web UI 直接打开预览）。

> 分析前提：当前 fork 已演进的能力以 `references/current-branch-migration-exclusions.md` 为准；分析以当前工作分支 `1.49`（fork 版本 `1.48.0-CN`）代码状态为基线。上游 commit 引用 `v1.49.3..v1.50.1` 范围内的 merge commit。分析方法为 4 个领域并行深度分析（CLI/Core、TUI、Web、Server+Infra），逐条比对上游 merge commit diff 与 fork 工作树。

## 分析方法说明

每项按以下维度给出结论：

| 维度 | 说明 |
|------|------|
| 任务核心目的 | 上游任务要解决的问题/提供的功能（一句话） |
| 变更内容摘要 | 上游 merge commit 实际改动的文件与逻辑 |
| 与当前定制代码的交集风险 | 高 / 中 / 低 + 理由 |
| 适合迁移的内容 | 可复用的具体逻辑/修复 |
| 需要排除/调整的内容 | 不应照搬的部分（含排除清单条目） |
| 迁移优先级 | A（必须合入）/ B（评估合入）/ C（跳过） |
| 迁移建议 | ①直接复用 / ②参考重写 / ③忽略 |

> **优先级重分类摘要**（相对 doc-9 初筛）：A1/A2 维持 A；**B10/B17 升 A**（SVR-1/SVR-2，fork 同根缺陷实证）；**B9/B12/B13/B18/B25 升 A**（TUI-2/4/5/6/8，真实交互/正确性缺陷）；**B7/B19 升 A**（WEB-2/3，fork 与上游 before 逐行同构）；**B1 升 A**（CLI-2，字段有存储无行为）；**B3/B22/B26 升 A**（CLI-4/11/13，create/edit 数据正确性 bug）；**B16 部分降 C**（BACK-624 超大重构与 fork BACK-568 移植重叠；BACK-623 留 B 取快速路径）；**B24 降 C**（CI-1，fork 无上游根因前提）；**B21 降 C 大部分**（WEB-4，fork 无 defaultAssignee 应用基线，仅 edit 清空小修留 B）。最终 15 A / 11 B / 7 C。

---

# 一、CLI / Core

## CLI-1：BACK-575 并发编辑 fail-fast（draft-94）

**任务核心目的**：把任务编辑的读-改-写放进文件级任务锁（proper-lockfile，`retries: 0`），锁内重读，争用即报错，杜绝并发编辑静默丢写。

**变更内容摘要**（merge `3b4fab0`，PR #860，6 文件 +135 任务记录/脚本）：核心是 `src/file-system/operations.ts` 与 `src/core/backlog.ts`：
- `operations.ts`：把 create lock 的锁逻辑泛化为 `withLockTarget`，新增 `withTaskLock(task, fn)`——锁目标为任务文件本身，lockfile 落在 `backlog/.locks/task-<id>`（每 checkout 独立，sibling worktree 不互相阻塞），`retries: 0`、stale 10s；新增 `TaskLockError`（`ETASKLOCK`）、`taskLockErrorMessage`、`toTaskLockError`（把 proper-lockfile 的 `ELOCKED`/`ENOENT`/`ECOMPROMISED` 映射为可读错误）；`isTaskLockError` 导出。
- `backlog.ts`：`updateTaskFromInput` 非 draft 分支整体包进 `fs.withTaskLock` 并在锁内 `loadLocalTaskForMutation` 重读；`demoteTaskWithUpdates` 自身加锁（覆盖 web funnel 与 MCP 直接调用两个入口），锁序恒为 task lock → create lock，无死锁。
- `mcp/tools/tasks/handlers.ts`：catch 中 `isTaskLockError` → `OPERATION_FAILED`。CLI 非零退出、web 409 由调用方既有错误路径承担。

**与当前定制代码的交集风险**：低 - 锁只包裹 read-modify-write，不触碰日期字段/里程碑/统计等 fork 定制逻辑；风险点仅是 `demoteTaskWithUpdates` 的结构差异（fork 的 demote 路径有 `updatedDate`/`normalizeAssignee` 等 fork 既有代码，包锁时需保持）。

**适合迁移的内容**：`withTaskLock`/`withLockTarget`/`TaskLockError` 全套（fork `operations.ts` 目前只有 create lock：`src/file-system/operations.ts:252-255`）；`updateTaskFromInput` 锁内重读（fork 现状 `src/core/backlog.ts:1869-1889` 是锁外 `fs.loadTask` + 无锁 apply，与上游修复前逐行同款；fork 末尾多了 `const refreshed = await this.fs.loadTask(taskId)` 重载，迁移时保留）；`demoteTaskWithUpdates` 自身加锁（fork `src/core/backlog.ts:2010-2040`）；MCP `isTaskLockError` → `OPERATION_FAILED`（fork `src/mcp/tools/tasks/handlers.ts:547` 的 catch 目前只有 VALIDATION_ERROR 分支）。fork 的 web PUT（`src/server/index.ts:1265` 直接 `updateTaskFromInput`）无需改动即被覆盖。

**需要排除/调整的内容**：无排除清单条目涉及；仅注意 fork 的 `updateTaskFromInput` 返回值多一次 reload（保留 fork 语义）；`USE_GLOBAL_TASK_ID_LOCK=false` 旁路开关可一并引入。

**迁移优先级**：A - 三入口（CLI/MCP/Web）都暴露无锁丢写（上游实测 8 并发写丢 7 个），属数据丢失类缺陷；fork 无任何任务锁，差距实锤。

**迁移建议**：①直接复用 - 上游改动自洽（同一文件同一函数），fork 对应函数形态与上游 pre-fix 一致，可近似逐块搬移。

---

## CLI-2：BACK-583 实现 defaultAssignee（draft-100）

**任务核心目的**：让已文档化但零行为的 `defaultAssignee` 配置真正生效：`config get/set/list` 支持，并在 core `createTaskFromInput` 层作为 assignee 兜底（显式 assignee 完全覆盖默认值）。

**变更内容摘要**（merge `84ea3fa`，PR #867，12 文件）：
- `src/core/backlog.ts`：`createTaskFromInput` 中新增 `resolvedAssignees = normalizedAssignees.length > 0 ? normalizedAssignees : (normalizeStringList(config?.defaultAssignee) ?? [])`，与 `defaultStatus` 同层生效，CLI/wizard/TUI/web/MCP 全覆盖。
- `src/file-system/operations.ts`：新增 `parseAssigneeConfigValue`（`Bun.YAML.parse` 严格解析，string/list/空值/非法→undefined）、`parseInlineConfigList`；`default_assignee` 解析分支改造。
- `src/cli.ts`：`CONFIG_GET_KEYS`/`CONFIG_SET_KEYS` 加入 `defaultAssignee`；`config get` 打印 `join(", ")`；`config set` 用 `parseDelimitedStringList`（空值清除）；`config list` 输出；help schema 文案。
- `src/mcp/utils/schema-generators.ts`：`assignee` 属性加 description。
- 类型为 `string[]`（规避多 assignee 缺陷类）；legacy scalar `default_assignee: "@name"` 仍可解析。

**与当前定制代码的交集风险**：低 - 与排除清单领域（日期/里程碑/统计）无交叠；但有**类型差异**：fork 的 `defaultAssignee?: string`（单字符串，`src/types/index.ts:331`），解析是 `value.replace(/['"]/g, "")`（`src/file-system/operations.ts:1443-1444`），序列化 `default_assignee: "..."`（`operations.ts:1593`），config watcher 同款单值。

**适合迁移的内容**：core 兜底逻辑（核心收益）：fork `src/core/backlog.ts:1031`（`normalizedAssignees`）与 `:1092`（`assignee: normalizedAssignees`）之间插入 resolvedAssignees fallback——这是预勘察确认的真实差距；`config get/set/list` 支持（fork `src/cli.ts:90-93` CONFIG_GET_KEYS、`:112-115` CONFIG_SET_KEYS、`:4404-4493` get、`:4511-4705` set、`:4734` list 均无 defaultAssignee 分支）；MCP schema description。

**需要排除/调整的内容**：上游把类型改为 `string[]` 会牵动 fork 的既有单字符串语义与测试（`src/test/enhanced-init.test.ts:164/192`、`src/test/filesystem.test.ts:394/784` 均断言单值 `"@alex"`/`"@admin"`），建议在 fork 内做 string[] 升级并同步改测试，而非保留 string 硬塞数组逻辑；解析建议沿用上游 `parseAssigneeConfigValue` 的严格 YAML（同时为 CLI-6 铺路）。排除清单无冲突条目。

**迁移优先级**：A - 预勘察与本次核对双重确认：fork 的字段"有存储无行为"，`config set defaultAssignee` 直接被拒绝（不在 SET_KEYS），create 不应用。

**迁移建议**：②参考重写 - 核心 fallback 一行逻辑直接复用；类型 string→string[] 的涟漪（types、operations 解析/序列化、watcher、测试）需 fork 侧适配。

---

## CLI-3：BACK-582 decision list 命令（draft-99）

**任务核心目的**：补齐 decision 的枚举能力——新增 `backlog decision list`（`--plain`/`--json`），并让 `decision create` 接受 `--plain` 与 help schema。

**变更内容摘要**（merge `d1618fb`，PR #871，5 文件）：
- `src/cli.ts`：`decision create` 加 help schema + `--plain`（接受即继续，create 本就输出单行纯文本）；新增 `decision list` 命令：`getReadOutputMode(options)` 解析输出模式（`--json --plain` 冲突复用共享 resolver），JSON 走 `printJson(decisionListJson(decisions))`，文本输出 `${id} - ${title} (${status})`，空列表打印 "No decisions found."；status 按存储原样。
- `src/formatters/json-output.ts`：新增 `decisionListJson`，复用既有 `toDecisionSummaryJson`，envelope 为 `{ schemaVersion: 1, kind: "decision-list", decisions: [...] }`。

**与当前定制代码的交集风险**：低 - decisions 不在排除清单领域；fork 已有 `fs.listDecisions()`（`src/cli.ts:1550` 被 ID 分配使用）与 `toDecisionSummaryJson`（`src/formatters/json-output.ts:66-70` 区域类型定义），基础设施齐全。

**适合迁移的内容**：`decision list` 命令主体、`decision create` 的 `--plain`/help schema、`decisionListJson`。fork 现状：`src/cli.ts:4150-4158` 只有裸 `decisionCmd.command("create <title>")`（无 help schema、无 --plain）。

**需要排除/调整的内容**：上游明言 scope 外：MCP 工具、状态过滤、交互选择器——fork 同样无需引入。无排除清单条目。

**迁移优先级**：B - 纯功能增益，无 bug；但 agent 指南已把 `--plain` 作为惯例，fork 的 `decision create --plain` 同样会报错，迁移成本极低。

**迁移建议**：①直接复用 - 两个 hunk 都是自包含追加，fork 的 `getReadOutputMode`（`src/cli.ts` 已有 task 类命令使用）可直接复用。

---

## CLI-4：BACK-572 清除任务依赖 + BACK-586 清除 references/documentation + BACK-618 空值清除列表标志（draft-92/103/120）

**任务核心目的**：三个连续演进任务合并：① `task edit --clear-deps` 清除依赖（修 `--dep ""`/`--ref ""` 假成功）；② `--clear-refs`/`--clear-docs` 与共享验证器（去重三份验证）；③ edit 列表 flag 显式空值 = 清除（与 `-a ""` 一致），create 空值仍报错。

**变更内容摘要**（merge `a20978d` PR #840 5 文件 + `b33ba6b` PR #862 5 文件 + `c9bbdbd` PR #890）：
- `a20978d`：`src/cli.ts` 加 `--clear-deps`；`src/utils/task-edit-builder.ts` 空数组清除语义；拒绝空 flag 值与 clear/set 冲突。
- `b33ba6b`：`src/cli.ts` 加 `--clear-refs`/`--clear-docs`，抽出共享 `validateClearableListInput`（按 occurrence 拒绝空值并指名匹配的 clear flag、clear-vs-setter 冲突拒绝、纳入 interactive-TTY 谓词）；`task-edit-builder.ts` 新增 `sanitizeClearableStringArray`（blank-only 数组 no-op、显式 `[]` 清除），deps/refs/docs 三个字段统一走它。
- `c9bbdbd`：`validateClearableListInput` 增加 `emptyClears` 入参——edit 三个替换族 `emptyClears: supportsClearFlags`（显式空值先过滤再走冲突检查，产出 `parseClearableStringList` 的 `[]` 清除）；create 与 `--add-ref/--remove-ref` 保持空值报错原文。
- 最终形态：上游 `src/cli.ts:545-650`（`validateClearableListInput`/`validateTaskListFlags`），`task-edit-builder.ts:19-31`（`sanitizeClearableStringArray`）及 deps/refs/docs 读取。

**与当前定制代码的交集风险**：低 - 无排除清单条目冲突；且 BACK-618 的"显式空字符串 = 清除"与 fork 既定的空字符串清除惯例（排除清单第 2 条）方向一致，属顺向增强。fork 侧差距：edit 命令无任何 `--clear-*` 列表 flags（grep `clear-deps|clear-refs|clear-docs` 零匹配）；`task-edit-builder.ts:80-105` 区域 deps/refs/docs 用的是 `sanitizeStringArray`（无 [] 清除、无空值报错）；fork edit 的 `--ref ""` 被 `parseDelimitedStringList` 吞掉后静默假成功（`src/cli.ts:2939-2941` 区域），与上游修的 bug 同款。

**适合迁移的内容**：`--clear-deps`/`--clear-refs`/`--clear-docs` flags；共享 `validateClearableListInput`/`validateTaskListFlags`（连同 CLI-5 的 add/remove-ref 互斥与 CLI-11 的 create 验证一次到位）；`sanitizeClearableStringArray` + `parseClearableStringList` 替换 edit 的 refs/docs/deps 读取；TTY 谓词纳入。

**需要排除/调整的内容**：无排除清单条目。注意与 fork 的日期类 `--clear-due-date` 等（`src/cli.ts:2644-2652` 区域）命名风格保持一致（上游用 `--clear-deps` 复数、`--clear-refs`/`--clear-docs` 复数——与 fork 的 `--clear-ac` 单数略异，按上游原文照搬即可）。

**迁移优先级**：A - 假成功（exit 0 但零变更）与无法清除列表是明确功能缺陷；三个上游任务代码是同一体系连续演进，合并迁移成本最低。

**迁移建议**：①直接复用 - 三个 merge 的最终态（v1.50.1 `cli.ts:545-650` + `task-edit-builder.ts`）整体搬移，fork 的 `task-edit-builder.ts` 与其上游 pre-fix 版本同构，替换面清晰。

---

## CLI-5：BACK-597 增量引用标志 --add-ref/--remove-ref（draft-105）

**任务核心目的**：消除 CLI-vs-MCP 表面漂移——`task edit` 支持 `--add-ref`/`--remove-ref`（可重复、逗号分隔），路由到 MCP 同款模型操作（添加去重、移除精确匹配）。

**变更内容摘要**（merge `ff8c4f0` PR #870 4 文件 + 补充 commit `6b539eb` 仅任务记录 49 行）：
- `src/cli.ts`：`task edit` 加 `--add-ref <reference>`/`--remove-ref <reference>`（可重复，逗号解析）；加入 interactive-TTY 谓词；空值按 occurrence 拒绝（共享验证器）；`--clear-refs` 与两者互斥；`--ref` 与增量 flags 同用报错（镜像 labels 规则）；add+remove 同值 → 移除（模型语义，测试钉死）。
- 无 core/builder/MCP 改动（模型层 `addReferences`/`removeReferences` 已存在）。
- `src/guidelines/agent-guidelines.md`：修正两行把 replace-all 写成 "add" 的文档。

**与当前定制代码的交集风险**：低 - fork 模型层已支持增量引用：`task-edit-builder.ts` 已有 `addReferences`/`removeReferences` sanitize（`:94-104` 区域），core `applyTaskUpdateInput` 已处理（fork `src/test/references.test.ts:84-124` 覆盖 add/remove/replace）。fork 缺的只是 CLI flags 与互斥验证（grep `add-ref|remove-ref` 在 `src/cli.ts` 零匹配）。

**适合迁移的内容**：`--add-ref`/`--remove-ref` 两个 Commander 选项（collecting + 逗号解析）；与 `--clear-refs`/`--ref` 的互斥验证（挂在 CLI-4 的 `validateTaskListFlags` 内）；TTY 谓词；guidelines 文案修正。

**需要排除/调整的内容**：上游验证逻辑内嵌在 `validateTaskListFlags`（`src/cli.ts:612-621` 区域），必须与 CLI-4 同批迁移，不可单独搬 flags。无排除清单条目。

**迁移优先级**：B - 功能增益（上游动机是 CLI/MCP 漂移，fork 同样存在该漂移，但无数据丢失）；依赖 CLI-4 落地。

**迁移建议**：①直接复用 - 与 CLI-4 合并为一个迁移任务实施，代码自洽。

---

## CLI-6：BACK-606 config 列表值 fail-fast + BACK-610 错类型 config fail-fast（draft-111/114）

**任务核心目的**：修掉 config 列表值的两级静默错误：① 一处 malformed YAML 拖垮整个文档解析并"猜"出错误值；② 值语法合法但类型错误（scalar/mapping 顶替 list）时静默忽略。两者都改为启动即报错。

**变更内容摘要**（merge `22bf766` PR #877 + `13e2519` PR #882，均主要动 `src/file-system/operations.ts` 与 `src/cli.ts`）：
- `22bf766`：新增 `extractConfigKeyYaml(content, key)`（按列 0 规则提取单 key 的 YAML 块，indented look-alike 不越权）与 `parseConfigListValue`（隔离解析，五个 list key：`statuses`/`labels`/`types`/`priorities`/`default_assignee` 走同一严格 helper）；删除 `parseInlineConfigList` 与 `parseAssigneeConfigValue` 的宽松路径；`FileSystem.loadConfig` 重构——I/O 失败仍返回 null，解析错误向上传播；`cli.ts` 新增 `reportCommandFailure()` + `isConfigValueError`，替换九处重复的 `console.error(summary, err)`；config watcher 同步改造；alias 场景（跨 key 锚点引用）回退整文档二次读取。
- `13e2519`：`parseConfigListValue` 的 `return undefined` 分支改为 throw；错误构造器带 problem+remedy 两段：`configSyntaxError` 保留 YAML 措辞，`configTypeError` 指名类型（`a scalar`/`a number`/`a boolean`/`a mapping`），`default_assignee` 特判"a list or a single name"；仅"key 缺失或显式空"返回 undefined。

**与当前定制代码的交集风险**：中 - 不触碰排除清单领域，但 fork 的 config 解析是上游修复前的同款逐行文本解析（`src/file-system/operations.ts:1439-1502`：`statuses`/`labels` 走 `parsedListValues` + 手工 `split(",")` 兜底 `:1458-1469`，`default_assignee` 走 `value.replace` `:1443-1444`），且 fork 的 `defaultAssignee` 是 string 而非 string[]——`parseConfigListValue` 对 `default_assignee` 的 list 语义需适配 fork 类型（或随 CLI-2 一起升级）。

**适合迁移的内容**：`extractConfigKeyYaml`/`parseConfigListValue`（列 0 匹配规则、块边界识别、alias 回退）；`configSyntaxError`/`configTypeError` 双错误体系；`loadConfig` 的"解析错误传播 vs I/O 失败返回 null"重构；`reportCommandFailure`/`isConfigValueError`。fork 的 `loadConfig` catch-all 吞错行为需核对后对齐。

**需要排除/调整的内容**：`default_assignee` 的 list 校验以 fork 类型体系为准（若 CLI-2 未先落地 string[]，则此处仅对 statuses/labels/types/priorities 四键启用 list 严格解析，`default_assignee` 暂用宽松校验并注释）。无排除清单条目。

**迁移优先级**：B - 健壮性/可诊断性提升，无数据丢失；"静默猜错配置"是隐蔽困惑源，且上游已把九个入口的报错统一，值得跟进。

**迁移建议**：②参考重写 - extractor/错误体系的核心逻辑直接复用；`default_assignee` 类型差异与 fork watcher 结构需适配；建议排在 CLI-2 之后。

---

## CLI-7：BACK-612 去重 generateNextDecisionId + 移除 core→CLI 动态 import（draft-115）

**任务核心目的**：删除 cli.ts 内的 `generateNextDecisionId` 本地副本，`core/backlog.ts` 改为静态 import `src/utils/id-generators.ts` 的唯一实现，消除 core→CLI 反向动态依赖（净 -71/+2 行）。

**变更内容摘要**（merge `d5aff68`，PR #884，3 文件 + 任务记录）：
- `src/core/backlog.ts`：line 37 改为 `import { generateNextDecisionId, generateNextDocId } from "../utils/id-generators.ts"`，`createDecisionWithTitle` 直接调用。
- `src/cli.ts`：import 共享 helper，删除 67 行本地副本（原 `cli.ts:1664-1730`）。
- 安全性：`utils/id-generators.ts` 只带 `import type { Core }`（编译期擦除），无运行时边；`backlog.ts` 本已静态 import `generateNextDocId`，复用既有无环边。

**与当前定制代码的交集风险**：低 - 纯重构。fork 现状与上游修复前逐行同款：`src/core/backlog.ts:2674-2676`（`await import("../cli.js")` + 调用）、`src/cli.ts:1547`（本地 `generateNextDecisionId` 副本）、`src/utils/id-generators.ts:81`（独立副本、零 importer）；`backlog.ts:35` 已静态 import `generateNextDocId`。

**适合迁移的内容**：backlog.ts 的 import 改静态（`:2675` 删除动态 import）；cli.ts 删本地副本（`:1547-1615` 区域）改用 utils 版。

**需要排除/调整的内容**：无。排除清单无条目；注意 fork 的 cli.ts 本地副本与 utils 版是否逐字节一致需在实施时 diff 核对（上游确认过 byte-identical，fork 因演进可能已漂移，若漂移则以 utils 版为基准核对行为）。

**迁移优先级**：B - 无行为变化的技术债清理，但改动极小、消除 core→CLI 反向依赖（利于后续打包/循环依赖排查），可随任意一批顺手完成。

**迁移建议**：①直接复用 - 两处替换即可，无涟漪。

---

## CLI-8：BACK-622 JSON 输出 AC 进度（draft-123）

**任务核心目的**：在 `task list`/`task view`/`search` 共用的 `toTaskSummaryJson` 里增加 acceptance criteria 完成计数，让 AI 代理无需展开 details 即可知 AC 进度。

**变更内容摘要**（merge `5158868` + `69524c0`，均小改）：
- `src/formatters/json-output.ts`：`toTaskSummaryJson` 增加 `acceptanceCriteriaCompleted: acceptanceCriteria.filter((criterion) => criterion.checked).length` 与 `acceptanceCriteriaCount: acceptanceCriteria.length` 两个字段。
- `src/test/cli-json-output.test.ts`（+74）与 CLI-INSTRUCTIONS.md（4 行）配套。

**与当前定制代码的交集风险**：低 - fork 的 `toTaskSummaryJson`（`src/formatters/json-output.ts:113-130`）无进度字段；注意字段名差异：上游 Task 的 AC 字段为 `acceptanceCriteria`，fork 为 `acceptanceCriteriaItems`（`toTaskDetailsJson` 用 `toChecklistJson(task.acceptanceCriteriaItems)`，`json-output.ts:139`；fork 的 `acceptanceCriteria` 数组存在于 details 层 `:147`）。迁移时计算源用 `task.acceptanceCriteriaItems`，并保持"completed/count"字段名与上游一致（对外 JSON 契约）。

**适合迁移的内容**：`toTaskSummaryJson` 两字段追加（一行计算）。fork 已移植 `src/utils/acceptance-criteria-progress.ts`（可作计数来源复用）。

**需要排除/调整的内容**：无排除清单条目；不要动 fork 的日期展示（`normalizePublicDate` 本地化逻辑 `:96-105`）与 details 层既有结构。

**迁移优先级**：B - 面向代理的 JSON 契约增强，无 bug；改动一行，收益直接（AI 读取任务列表即可见进度）。

**迁移建议**：①直接复用 - 单 hunk 追加，仅字段名适配（acceptanceCriteriaItems）。

---

## CLI-9：BACK-598 Dependabot 修复（draft-106）

**任务核心目的**：mermaid 11.16.0 → 11.16.1，修复 5 个 GHSA（radar/XY-chart DoS、config/architecture 原型污染、CSS 注入）——mermaid 被打进发布二进制并在运行时渲染仓库 markdown，属真实暴露面。

**变更内容摘要**（merge `1cba9ab` PR #868 + `f346bb8` 任务记录）：`package.json` + `bun.lock`（仅 mermaid，零传递依赖变化）+ `bun.nix` 再生（3 行 hash）+ 任务记录；附带两次独立供应链验证（SLSA provenance、tarball 字节级对比）。

**与当前定制代码的交集风险**：低 - fork `package.json:43` 为 `"mermaid": "11.15.0"`，上游修复目标是 11.16.1（fork 连 11.16.0 都未到，直接升 11.16.1 即可）。排除清单无条目。

**适合迁移的内容**：版本 bump 至 `11.16.1`（或当前最新无已知漏洞的 11.x），同步 `bun.lock` 与 `bun.nix` hash。若 fork 的锁文件是 bun.lock 体系（fork 用 bun，`package.json` 同款），操作即 `bun update mermaid` 后核验锁文件 diff 只含 mermaid。

**需要排除/调整的内容**：无（上游验证过程是流程性内容，不迁移）。

**迁移优先级**：B - 安全补丁，上游定性"fixes reach users"；非 fork 定制回退风险，但安全暴露面真实，应尽快纳入近期批次。

**迁移建议**：①直接复用 - 纯依赖版本操作。

---

## CLI-10：BACK-623 CLI 命令避免跨分支工作 + BACK-624 跨分支加载增量缓存（draft-124/125）

**任务核心目的**（两个任务合并分析）：① BACK-623：常见 CLI 命令（view/edit/list/父解析/依赖校验）改为工作副本本地优先，不初始化跨分支 ContentStore，miss 时带提示 fail-closed（no-op edit 12.2s → 0.4s）；② BACK-624：跨分支加载改为"单一不可变 tip 快照 + commit/blob 共享缓存 + 精确内容解析缓存 + 热工作副本对账"，热读从 ~394 次 git 操作降到 ≤3 次，fetch 合并且 10s 上限、离线优雅降级。这是 v1.50.1 hotfix，重点评估 fork 是否已本地优先。

**变更内容摘要**（merge `aca8007` PR #898，15 文件 +655/-210；merge `94c10a6` PR #899，31 文件 +5363/-1987）：
- BACK-623 `src/core/backlog.ts`（+116/-）：`queryTasks` 加 `!includeCrossBranch` 快速路径（直接用 `fs.listTasks()`，不触 ContentStore）；`getTaskWithSubtasks`/`loadTaskById`/`editTask`/`updateTaskFromInput` 增 `TaskReadOptions { includeCrossBranch }`，false 时走新 `loadWorkingCopyTask`（local+completed 任务经 `buildTaskIdentityIndex` fail-closed 解析）；`resolveParentTaskIdForCreate`、`applyTaskUpdateInput` 依赖校验统一到本地 corpus 并带 `LOCAL_TASK_LOOKUP_HINT`；`src/search-service.ts`（-63）裁剪；`src/cli.ts`（+70/-）：view/shorthand/edit/list 全部传 `{ includeCrossBranch: false }` 并把 miss 提示改为 `Task ${id} not found. ${LOCAL_TASK_LOOKUP_HINT}`；`resolveParentFilterId` 改走 `loadTaskById(..., false)`；新增 `src/utils/task-id-search.ts`；`src/server/index.ts`（4 行）web `/tasks` 恢复 store-backed 跨分支路径。
- BACK-624 `src/core/task-loader.ts`（-881 重写）：`commitIndexCache`/`taskCache` 等按 commit 键控缓存、tip 快照不可变、精确内容解析缓存、快照指纹仅由 store-installing 加载发布、ID 分配强制刷新快照（关重复 ID 窗口）；`src/git/operations.ts`（+231）：repository 级缓存；`src/core/content-store.ts`（+166）：快照增 `branchStateEntries`/`config`，`mergeConcurrentTaskCorpus` 对账；`src/core/backlog.ts`（+819）大改；`src/file-system/operations.ts`（+162）。附带 767 行 benchmark 脚本。

**fork 现状（重点核对）**：
- **本地优先程度**：fork `loadTaskById`（`src/core/backlog.ts:484-493`）已"本地 fs.loadTask 优先 → miss 后 `checkActiveBranches`/`activeBranchDays`(默认 30 天) 窗口内跨分支 `getLatestTaskStatesForIds` 兜底"——即**本地优先 + 跨分支 fallback**，而非上游的 fail-closed。`getTaskWithSubtasks`（`:474-482`）无 options；`editTask`（`:2087-2088`）无 options 透传。
- **queryTasks 性能**：fork `queryTasks`（`:378-404`）即使 `includeCrossBranch: false` 也先 `getContentStore()`（`loadTasks` 含 `loadRemoteTasks`/`loadLocalBranchTasks` 跨分支扫描，`:3024-3110`）再 `filterLocalEditableTasks` 过滤——**上游要消除的"无查询也初始化跨分支 store"问题在 fork 原样存在**。
- **缓存设施**：fork 已有 BACK-568 移植：`content-store.ts:18` `TaskCorpusSnapshot`、`task-loader.ts` 索引-first/hydrate-later（`buildRemoteTaskIndex`/`loadRemoteTasks`）、`task-identity-index.ts`；但 `src/git/operations.ts` 无任何 cache 设施（grep 零匹配）——BACK-624 的 commit/blob/解析缓存是 fork 完全缺失的新层。
- **行为变更点**：上游让 CLI 对"其他分支任务"完全不可解析（fail-closed + hint）；fork 目前可解析（30 天窗口），这是刻意保留的数据流（预勘察关键决策：`getLatestTaskStatesForIds` 近 30 天窗口不动）。

**与当前定制代码的交集风险**：中-高 - BACK-624 触及 `core/backlog.ts`（819 行）、`task-loader.ts`（整文件重写）、`content-store.ts`、`git/operations.ts`，与 fork 的 BACK-568 移植（task-loader 索引模式、content-store 快照）大面积重叠但版本不同（fork 是 v1.49.3 期形态），整体合并冲突面极大、行为回归风险高。BACK-623 的行为变更（CLI 不再解析跨分支任务）与 fork 的 30 天窗口数据流直接冲突——需要产品决策。排除清单无直接条目，但"跨分支可解析"可视为 fork 已演进能力（custom 行为），上游改动若整体照搬即回退该能力 → 按排除清单通用原则第 5 条应参考重写。

**适合迁移的内容**：BACK-623 的 `queryTasks` 本地快速路径（`!includeCrossBranch` 时不初始化 ContentStore，直接 `fs.listTasks()`）——**纯性能修复、无行为变更**，可独立采纳；fork `queryTasks:401-404` 改法即上游 hunk。BACK-623 的依赖/父解析本地化（`validateDependencies` 走本地 corpus + hint 文案）——可选，需保留 fork 的跨分支 fallback 语义（仅当 fork 决定维持现状时）。BACK-624 的 fetch 合并/10s 上限与离线降级、repository 级缓存——可拆成后续长期增量，不与整体重构绑定。

**需要排除/调整的内容**：**BACK-623 的 CLI fail-closed**（其他分支任务在 CLI 不可解析 + `LOCAL_TASK_LOOKUP_HINT`）：若 fork 要保留 30 天窗口跨分支解析，则不采纳该行为变更，只采纳快速路径与本地优先读取（fork 已具备）。若 fork 接受上游"CLI 纯本地、跨分支只在 web"的产品决策，则完整迁移——需用户拍板。**BACK-624 整体合并**：与 fork BACK-568 移植重叠冲突，不建议整体合并；排除清单通用原则 5（fork 已演进能力优先）。

**迁移优先级**：BACK-623：B - 上游 hotfix 动机是性能（12.2s→0.4s），fork 的 CLI 冷路径同样慢（每次 list 都扫跨分支）；但行为变更需决策，快速路径部分可先行。定 B（含行为决策依赖）。BACK-624：C - 超大重构（+5363/-1987），与 fork 既有 task-loader/content-store 重叠冲突，收益集中在 web/MCP 热路径，fork 冷路径问题由 BACK-623 快速路径先解决大半；整体迁移性价比低。引用排除清单通用判断原则第 5 条。

**迁移建议**：②参考重写（BACK-623：选择性采纳快速路径+本地优先读取，保留 fork 跨分支 fallback；BACK-624：③忽略整体，后续以增量形式单独评估 commit/blob 缓存）。

---

## CLI-11：BACK-603 create/draft 标志与 edit 对齐（draft-108）

**任务核心目的**：`task create` 与 `draft create` 的三个缺陷对齐到已加固的 edit 路径：① 重复 `-l/--labels` 丢值（非 collecting）；② 空列表值静默吞掉（`--dep ""`/`--ref ""` 假成功）；③ `dependsOn || dep` 别名 quirk（`--depends-on` 恒赢、`--dep` 值被丢、`--depends-on "" --dep X` 创建出无依赖任务）。

**变更内容摘要**（merge `36c0f65`，PR #878，`src/cli.ts` 为主 + 测试）：
- `task create`/`draft create` 的 `-l, --labels` 改用共享 `createMultiValueAccumulator()`（收集 + `parseDelimitedStringList` 逗号拆分 + 去重）。
- create 依赖合并改为 `[...toStringArray(options.dependsOn), ...toStringArray(options.dep)]`（与 edit 同款）。
- 抽取 `validateTaskListFlags(options, { supportsClearFlags })`，create/edit 共用一套依赖/引用/文档验证（edit 原内联链 verbatim 移入），create 传 `supportsClearFlags: false`。
- create action 的 `assignee: parseClearableStringList(options.assignee)`、`labels: parseDelimitedStringList(options.labels)`。

**与当前定制代码的交集风险**：低 - 无排除清单条目。fork 现状：create `-l` 非收集（`src/cli.ts:1658`）、action 手写 split（`:1735-1740` 区域）、`dependencies: options.dependsOn || options.dep ? normalizeDependencies(options.dependsOn || options.dep) : undefined`（`:1742-1743` 区域，|| quirk 与上游 pre-fix 同款）；draft create 同款（`:3379` 非收集 `-l`、`:3408-3413` 区域）；fork edit 已合并两种拼写（`:2936-2938` combinedDependencies）。

**适合迁移的内容**：create/draft 的 `-l` collecting；create 依赖合并；`validateTaskListFlags` 抽取并让 create 走 `supportsClearFlags: false`（与 CLI-4 的 edit 验证合并成一次迁移）。

**需要排除/调整的内容**：上游 create 的 `assignee: parseClearableStringList` 依赖 CLI-2 的 string[] 类型升级（fork 当前 `[String(options.assignee)]`，`:1733`）——若 CLI-2 未先落地，此处先只做 labels/依赖/验证三件，assignee 随 CLI-13 的 -a collecting 一起处理。无排除清单条目。

**迁移优先级**：A - create 路径丢值/假成功是数据正确性 bug（上游实测 `-l a -l b` 只存 b、`--dep` 值被吞）。

**迁移建议**：①直接复用 - 与 CLI-4/CLI-5 共享 `validateTaskListFlags` 体系，三任务合并实施。

---

## CLI-12：BACK-608 gray-matter 缓存投毒（draft-112）

**任务核心目的**：用唯一共享的 no-cache 解析包装（`src/markdown/frontmatter.ts`）替代全部直接 `gray-matter` 调用，消除模块级缓存投毒（调用方 mutate 解析结果污染后续同内容解析；malformed 文档只首次抛错）。

**变更内容摘要**（merge `7d4e96b`，PR #875，9 文件）：
- 新建 `src/markdown/frontmatter.ts`（20 行）：`parseFrontmatter(content)` → `matter(content, {})`、`stringifyFrontmatter(content, data)` → `matter.stringify(content, data, {})`——gray-matter 4.0.3 仅在 options 为 falsy 时读写缓存，传 `{}` 即绕过。
- `src/markdown/parser.ts`（`parseMarkdown`）、`src/markdown/serializer.ts`（`serializeTask`/`serializeDecision`/`serializeDocument`/`serializeMilestone`）、`src/file-system/operations.ts`（6 行）全部改走包装。

**与当前定制代码的交集风险**：低 - 纯封装重构，不动解析语义。fork 直接调用点多于上游（fork 特有调用点需一并覆盖）：`src/markdown/parser.ts:1,140`（`parseMarkdown` 直接 `matter(toParse)`）；`src/markdown/serializer.ts:1,129,150,163,178`（五处 `matter.stringify`）；`src/file-system/operations.ts:3,1642,1678,2064,2093`（config list 提取与文件写入）；`src/core/backlog.ts:2650-2651`（`updateDecisionFromContent` 动态 import gray-matter）；`src/commands/wiki-install.ts:4,54`（fork 特有命令，读取 skill frontmatter）。

**适合迁移的内容**：`frontmatter.ts` 包装（20 行，原样复用）；上述全部调用点改走 `parseFrontmatter`/`stringifyFrontmatter`（含 fork 特有 `wiki-install.ts`）；`backlog.ts:2650` 的动态 import 顺带改为静态 import 包装（与 CLI-7 同向）。

**需要排除/调整的内容**：无排除清单条目；`operations.ts:1642/1678` 的 config 块解析若随 CLI-6 迁移会被 `extractConfigKeyYaml` 取代，注意顺序（先 CLI-6 后此任务可减少改动面）。

**迁移优先级**：B - 隐蔽正确性 bug（投毒依赖"调用方 mutate 结果"这一触发条件，fork 的 `parseMarkdown` 调用方是否 mutate 需在实施时核查），但迁移成本极低、且顺带消除 core→CLI 动态 import（`backlog.ts:2650`）。

**迁移建议**：①直接复用 - 包装函数逐字复用，调用点机械替换。

---

## CLI-13：BACK-576 create 多 assignee + BACK-574 清空 defaultEditor（draft-95/93）

**任务核心目的**：① create 路径 `-a` 支持多 assignee（collecting + 逗号解析），修 `task create -a "@a,@b"` 存成单个字面值、重复 `-a` 只留最后一个；② `config set defaultEditor ""` 与 `init --default-editor ""` 能真正清空（当前被 executable 校验与 truthiness fallback 卡死）。

**变更内容摘要**（merge `d8f394f` PR #858，6 文件；merge `3b3bddc` PR #855，3 文件）：
- BACK-576 `src/cli.ts`：`task create`、`task edit`、`draft create` 三处 `-a, --assignee` 改为 `createMultiValueAccumulator()` collecting，action 里 `[String(options.assignee)]` → `parseDelimitedStringList(options.assignee)`；help schema 措辞对齐 labels 惯例；顺带把手写 label split 块替换为共享 `parseDelimitedStringList`。
- BACK-574 `src/cli.ts`：`config set defaultEditor` 空值跳过 `isEditorAvailable` 校验（序列化层本就省略空值 → 键被移除）；init fallback 链把 `""` 视为"已提供"，清掉此前配置的编辑器；非空值仍校验。

**与当前定制代码的交集风险**：低 - 无排除清单条目；且 BACK-574 的"空字符串清除"与 fork 既定惯例（排除清单第 2 条）方向一致。fork 现状：三处 `-a` 均非收集（`src/cli.ts:1656` create、`:2638` edit、`:3377` draft），action 均 `[String(options.assignee)]`（`:1733`、edit `:2912-2913` 区域走 `parseDelimitedStringList(options.assignee)` 但 CLI 侧仍单值、`:3408`）；`config set defaultEditor` 先 `isEditorAvailable(value)`（`:4524-4533`，空值被拒）；init `defaultEditor` 链 `options.defaultEditor || existingConfig?.defaultEditor || EDITOR || VISUAL`（`:988-993`，空串被 `||` 吞）。

**适合迁移的内容**：三处 `-a` collecting + `parseDelimitedStringList`（与 CLI-2 的 assignee 类型升级协同）；`config set defaultEditor` 空值分支跳过校验（`src/cli.ts:4524` 的校验块加空值短路）；init fallback 链空串处理（`:988-993`）。

**需要排除/调整的内容**：无排除清单条目；BACK-576 上游同时把 edit 的 `-a` 也 collecting——fork edit 侧 `-a` 单次即可满足常见用法，但为对齐契约建议三处一起改。`parseClearableStringList`（上游 create 用）依赖 CLI-2 类型升级，未升级前用 `parseDelimitedStringList` 等价实现。

**迁移优先级**：A - `-a "@a,@b"` 存字面值是数据错误 bug；defaultEditor 无法清空是功能缺陷（且 fork 的 shipped 默认 `code --wait` 有挂起风险，同上游动机）。

**迁移建议**：①直接复用 - 两处改动都小且自洽；`defaultEditor` 部分可独立先行。

---

# 二、TUI

## TUI-1：BACK-546 依赖就绪指引 TUI+browser（draft-90）

**任务核心目的**：为任务派生「依赖就绪度」（ready / blocked-by / unknown-dependency），在 CLI `task list --ready`、MCP `task_list ready`、TUI 详情面板就绪行、浏览器任务弹窗徽章四处暴露。

**变更内容摘要**（merge 646d9bb，18 文件 +1193/-23）：
- 新增 `src/utils/readiness.ts`（149 行）：`createReadinessGraph` / `getTaskReadiness` / `formatReadinessBlockers`，仅按 dependencies 计算，无排序语义。
- `src/ui/task-viewer-with-search.ts`：加载层并行 `core.filesystem.listCompletedTasks()`；构建 `buildReadinessGraph`（unfiltered 快照 + completed corpus）；在 `generateDetailContent` 注入 `ReadinessGraph` 渲染 `{bold}Readiness:{/}` 行（绿色 ✓ 或黄色 ●，注释明确用单宽字形规避 blessed 宽字符残留）。
- `src/ui/unified-view.ts`：`readyFilter` 透传；`src/utils/task-search.ts` `applyTaskFilters` 增加 `ready?: ReadinessGraph` 过滤。
- `src/cli.ts`：`task list` 增加 `--ready` 选项与 handler 内 `loadReadinessGraph(core)` 过滤。
- 另有 `src/mcp/tools/tasks/handlers.ts`、`src/web/components/TaskDetailsModal.tsx` 徽章、`src/test/readiness.test.tsx` 等。

**与当前定制代码的交集风险**：低 - fork 无任何 readiness 实现（`src/ui/` 与 `src/utils/` 无 readiness/task-id 文件；`src/cli.ts:2194-2242` `task list` help schema 无 `--ready`；`task-viewer-with-search.ts:200` 仅 `Promise.all([listMilestones, listArchivedMilestones])`，无 `listCompletedTasks`；`task-viewer-with-search.ts:986` `generateDetailContent(currentSelectedTask, resolveMilestoneLabel)` 仅 3 参；`task-search.ts:266` `applyTaskFilters` 无 ready 分支）。fork 已有全部前置件：`Task.dependencies`（`types/index.ts:117`）、`listCompletedTasks`（`core/file-system/operations.ts:455`）、`taskIdsEqual`/`normalizeTaskId`（`utils/task-path.ts`，上游用 `utils/task-id.ts` 需改名适配）。与排除清单（日期/里程碑/甘特图/统计/WebSocket）无交集。

**适合迁移的内容**：`readiness.ts` 计算核心（纯函数，可原样搬入，仅把 `task-id.ts` 导入换为 fork 的 `task-path.ts` 等价函数）；`task list --ready` CLI 选项 + `loadReadinessGraph` 过滤；TUI 详情面板 Readiness 行（含单宽字形注释经验）；浏览器 TaskDetailsModal 徽章（fork 有 `src/web/components/TaskDetailsModal.tsx`）。

**需要排除/调整的内容**：无排除清单条目冲突；但 fork 无 `src/utils/task-id.ts`，需将 `canonicalTaskId`/`taskIdsEqual` 映射到 `src/utils/task-path.ts` 现有导出（`task-path.ts:171/361` 已有 `taskIdsEqual`）。MCP 部分（handlers.ts 增加 ready 参数）需核对 fork MCP schema 生成方式。

**迁移优先级**：B - 全新能力增强（非缺陷修复），体积大（~1193 行含测试），无冲突；可作为独立增量分批落地。

**迁移建议**：②参考重写 - `readiness.ts` 核心逻辑①直接复用；TUI/CLI/MCP 集成按 fork 的 `task-search.ts`、CLI handler 结构适配（fork 的 `viewTaskEnhanced` 加载流程与上游已有差异，不能整文件 apply）。

---

## TUI-2：BACK-565 TUI composer UX 修复（draft-91）

**任务核心目的**：重做任务创建 composer——紧凑响应式 Title/Description/Details/Actions 层级、方向键空间导航（保留文本光标与多行行为）、Tab/Shift+Tab 惰性化，并修复底层 popup chrome 与选择器。

**变更内容摘要**（merge 38d6afa，10 文件 +1254/-312；补充 commit b219c03/b8ad15a 仅文档，无代码）：
- `task-composer.ts`：新增 caret 换算（`caretIndexFromCursor`/`cursorFromCaretIndex`）与 Unicode 安全删除（`deletionStart`/`deletionEnd`，surrogate pair 处理）；改为 `createScrollableViewport` 视口 + Details 分组框 + Actions 行；重构 `getFieldTops`/`applyLayout`；自持 backspace/delete/C-w 键并 `ownInputKeys` 拦截；选择器/按钮四向箭头导航。
- `filter-popup.ts`：引入 `scrollablebox`（`createScrollableViewport`，注释说明 `box({scrollable:true})` 在 neo-neo-bblessed 是 no-op）；`fitToScreen` 防止 popup 超出屏幕；**关键修复 `picker.select(selectedIndex)`**——blessed list 忽略 `selected` 选项，不显式 select 则 Enter 确认错项。
- `help-popup.ts`：动态高度 `getHelpPopupHeight` + 滚动视口（短屏不溢出）。
- `board.ts`：新增 `screen.key(["n","N","S-n"])` 创建任务入口 + `taskCreationOpen`/`taskCreationPendingUpdate` 与 watcher 更新互斥；`unified-view.ts` 传 `createTask`。

**与当前定制代码的交集风险**：中 - fork 已通过自研 commit 迁移了本任务主体：`task-composer.ts:24` FIELD_ORDER、`:108` compact 阈值、`:242` openTaskComposer、`:476` navigate、`:501` moveFocus、`:596` Tab、`:707` 四向箭头；`board.ts:932` N 键入口、`:940` 回退；`unified-view.ts:472` 传 `createTask`。**仍有 3 处上游修复未落地**：① `filter-popup.ts:201` 仅传 `selected: selectedIndex` 给 `list(...)`，缺 `picker.select(selectedIndex)`——单选 popup 打开时高亮停在首行，Enter 会确认非当前值；② `filter-popup.ts:292-296` multiSelect 未传 `itemRenderer: (item) => item.title`，fork `generic-list.ts:101-105` 默认渲染 `${item.id} - ${item.title}`，而 fork 的 `selectableItems = items.map(label => ({id: label, title: label}))`（filter-popup.ts:287）→ 显示 "label - label" 重复文本；③ `help-popup.ts:27-49` 仍是静态 `height: 20` 无滚动，缺 `getHelpPopupHeight`。fork 刻意差异（勿回退）：无 Type 选择器；`textareaWidget` 运行时取用绕过 d.ts 类型缺口；`unkeyEscape`（task-composer.ts:509-515）；priority 选项用 fork 内联三值。

**适合迁移的内容**：上述 3 处缺口——`picker.select(selectedIndex)`、multiSelect `itemRenderer`、help-popup 动态高度滚动。

**需要排除/调整的内容**：不恢复 Type 选择器（fork 无任务类型体系）；不照搬上游 `textarea` 直接 import（fork 有 bun/d.ts 解析缺口，必须保留 `textareaWidget` 变通）；排除清单无直接条目，但注意 fork 的 `FIELD_ORDER`/`navigate` 已按无-type 布局调整，打补丁时勿整段替换导航表。

**迁移优先级**：A - 单选选择器确认错项是真实交互缺陷（用户打开状态选择器按 Enter 会选错值），且改动极小。

**迁移建议**：①直接复用 - 三处都是上游现成补丁级改动，按 fork 行号定点移植（filter-popup.ts:201 后补 `picker.select(selectedIndex)`；multiSelect 选项补 `itemRenderer`；help-popup 换动态高度实现）。

---

## TUI-3：BACK-577 TUI 窗口标题含项目名（draft-96）

**任务核心目的**：TUI 各视图窗口标题带上项目名（`<项目名> - <视图>`），便于多终端区分；并对标题做控制字符清洗防注入。

**变更内容摘要**（merge 2ee06c5，10 文件 +169/-20）：
- `src/ui/tui.ts`：新增 `stripControlCharacters`（剔除 C0/C1/DEL）与 `formatTuiTitle(view, projectName?)`（空名/"Untitled Project" 回落 `Backlog <view>`）。
- `board.ts`：`createScreen({ title: formatTuiTitle("Board", options?.projectName) })`，options 增 `projectName?`；`task-viewer-with-search.ts` 两处（无结果态、选中态）改用 `formatTuiTitle`；`overview-tui.ts`、`enhanced-views.ts`/`simple-unified-view.ts`/`unified-view.ts` 传 `projectName: config?.projectName`。

**与当前定制代码的交集风险**：低 - fork 无任何窗口标题代码：`src/ui/tui.ts` grep `tput|tmux|setTitle|title` 无自定义标题逻辑（仅 `tput: false` 选项，tui.ts:51）；`board.ts:271` 硬编码 `createScreen({ title: "Backlog Board" })`；`task-viewer-with-search.ts:286` `options.title || "Backlog Tasks"`、`:947`、`:984` 均无项目名；`board.ts:249-253` options 无 `projectName`。**注意**：fork 的 `overview-tui.ts` 是纯文本 stdout 渲染（`overview-tui.ts:25` `renderOverviewTui` 用 `process.stdout` 打印，非 blessed screen），上游的 blessed 标题改动在该文件不适用。

**适合迁移的内容**：`formatTuiTitle` + `stripControlCharacters`（tui.ts）；board/task-viewer 两处标题拼接与 `projectName` 选项透传；unified-view/enhanced-views/simple-unified-view 传参。

**需要排除/调整的内容**：overview-tui 的 blessed 标题部分跳过（fork 为文本渲染，如需标题应另走 ANSI OSC 序列，不属于本任务直接照搬范围）。

**迁移优先级**：B - 体验增强（多终端区分），非缺陷；改动面小（~10 处），但与 TUI-6 的 tmux 标题恢复同文件同区域，建议合并迁移避免二次冲突。

**迁移建议**：②参考重写 - `formatTuiTitle` 可①直接复用；视图侧按 fork 现有 `options` 形状（board.ts:249-253）补 `projectName` 字段并透传；overview-tui 部分忽略。

---

## TUI-4：BACK-584 vim 键边界 + BACK-616 filter popup vi 导航（draft-101/118）

**任务核心目的**：列表/看板在导航边界区分方向键与 vim 键——方向键在边界交还搜索框（及空列跳搜索），vim 键（j/k）停在列表内不越界；并为 filter popup 单选选择器补 j/k 导航。

**变更内容摘要**：
- BACK-584（merge 645b5cd，6 文件 +341/-113）：`generic-list.ts` 新增 `BoundaryNavigationKey = "arrow" | "vim"`；`onBoundaryNavigation` 增第 4 参 `key`，`moveUp`/`moveDown` 带 key；拆分绑定：`up`→`moveUp("arrow")`、`k`→`moveUp("vim")`、`down`/`j` 同理。`task-viewer-with-search.ts`：`shouldMoveFromListBoundaryToSearch` 重构为 `resolveListBoundaryNavigation(direction, selectedIndex, total, key)` 返回 `"move" | "search" | "stay"`（vim 边界 = stay）；onBoundaryNavigation 改四参；详情面板 `up/k` 拆分，vim 交给内置滚动钳制。`board.ts`：`screen.key(["up","k"])`/`["down","j"]` 合并 handler 重构为 `moveBoardSelection(direction, key)`，边界经 `resolveListBoundaryNavigation`。
- BACK-616（merge 842c4f8，3 文件 +155/-10）：`filter-popup.ts` 单选 popup 显式 `picker.key(["j"], moveBy(1))` / `["k"], moveBy(-1)`（`select()` 钳制，不引入 `vi: true` 以免附带 l/q/g/G/H/M/L/Ctrl+B/U/D/F 绑定）；help 文案改为 `[↑↓/jk]`。

**与当前定制代码的交集风险**：中 - fork 现状 = 上游 pre-584 语义：`generic-list.ts:31` `onBoundaryNavigation?: (direction, selectedIndex, total) => boolean`（无 key 参）；`:294` 注释 "Circular navigation for up/down (including vim-style keys)"，`:299`/`:309` 调用无 key，`listBox.key(["up","k"], moveUp)`/`["down","j"]` 合并绑定；`board.ts:1050-1100` 仍是 `screen.key(["up","k"], ...)` 双 handler + `shouldMoveFromListBoundaryToSearch`（board.ts:1062/1099）；`task-viewer-with-search.ts:74-91` 旧 `shouldMoveFromListBoundaryToSearch`/`shouldMoveFromDetailBoundaryToSearch`，`:829` 三参 onBoundaryNavigation；`filter-popup.ts` 无 j/k 绑定。**关键语义差异**：fork generic-list 当前是「循环 + 可选边界交还」——`moveUp` 在 `sel<=0` 且 handler 未消费时回绕到 `total-1`（generic-list.ts:299-302）。上游 584 未改变 popup 的循环语义（其 commit message 明说 "intact picker wrapping"），只让 vim 键在列表边界 stay；迁移时需保留 fork 现有循环行为，仅把「vim 键也触发搜索交还」改为「vim 键在边界停留」。

**适合迁移的内容**：`BoundaryNavigationKey` 类型与四参 onBoundaryNavigation；`resolveListBoundaryNavigation`（含 "stay" 分支）；board `moveBoardSelection` 合并 handler；详情面板 up/k 拆分；filter-popup j/k 显式绑定 + help 文案。

**需要排除/调整的内容**：不引入 `vi: true`（上游 616 已论证其副作用并弃用，照搬其显式绑定方案即可）。注意 fork board.ts 与上游 38d6afa 一致，但 645b5cd 之后上游 board.ts 又叠加了 577/615 改动，`moveBoardSelection` 补丁需对照 fork 当前 1050-1100 行手工套用，不可整文件覆盖（会引入 577 的 projectName 等连带）。

**迁移优先级**：A - 真实导航缺陷：fork 中按 `k` 到列表顶部会跳出到搜索框/在 popup 外触发，违背 vim 直觉；上游已有完整修复与测试（tui-vim-boundary-navigation.test.ts）。

**迁移建议**：②参考重写 - generic-list 的 key 参与四参 handler 可①直接复用；board/task-viewer 两个调用面按 fork 行号重写为 key 感知逻辑，保留 fork 循环语义。

---

## TUI-5：BACK-615 TUI hideEmptyColumns（draft-117）

**任务核心目的**：把 fork web 端已有的 hideEmptyColumns 能力补到 TUI 看板——Shift+H 切换、持久化到共享配置、piped 输出同步隐藏，并保持移动任务时列不隐藏。

**变更内容摘要**（merge bee30b4，5 文件 +437/-33）：
- `board.ts`：`filterVisibleColumns(data, hideEmptyColumns, isMoving)`（isMoving 时全保留；全空则全保留防白板）；options 增 `hideEmptyColumns?`；piped 分支也按 `filterVisibleColumns(...).map(c => c.status)` 过滤；状态 `hideEmptyColumns` + `pendingSettingWrite`；`renderView` 内 `dataForColumns = filterVisibleColumns(projectedData, hideEmptyColumns, Boolean(moveOp))` + `closeBoard`（退出前 await 未完成的设置写入）；`toggleHideEmptyColumns`（乐观切换→`core.fs.saveConfig({...config, hideEmptyColumns})`→失败回滚 + transient footer）与 `screen.key(["S-h"])`（并发写入互斥）。
- `help-popup.ts` +`{ key: "H", desc: "Hide/show empty columns" }`；`unified-view.ts` 传 `hideEmptyColumns: config?.hideEmptyColumns ?? false`。

**与当前定制代码的交集风险**：低-中 - fork 配置与 web 端已完整支持：`types/index.ts:347` `hideEmptyColumns?: boolean`；`core/file-system/operations.ts:1483`（hide_empty_columns 解析）、`:1572`/`:1605`（序列化）；`cli.ts:4465-4575` config get/set、`:4401` 可用键；`src/web/components/Board.tsx:37/69/369-380`、`App.tsx:742`、`Settings.tsx:413-422`、4 个 locale。TUI 侧缺口：`src/ui/board.ts` 无 `filterVisibleColumns`/`hideEmptyColumns`/`S-h`；`unified-view.ts:448` renderBoardTui 调用不传 hideEmptyColumns；help-popup 无 H 项；`board.ts:158` DEFAULT_FOOTER_CONTENT 无 H 提示。**与排除清单 #5 交互**：fork board 移动态 cyan 高亮（`board.ts:516-517`/`:537-556` `setColumnActiveState` 中 `listStyle.selected.bg = moveOp ? "cyan" : undefined`）是有意定制。上游 `filterVisibleColumns` 的 `isMoving` 参数天然与「移动时列全保留」兼容（移动态下 cyan 目标列仍可见），迁移时勿中性化该高亮。

**适合迁移的内容**：`filterVisibleColumns` 纯函数；Shift+H toggle + `pendingSettingWrite` 并发互斥 + `closeBoard` await；piped 分支过滤；unified-view 传参；help-popup/footer H 提示。

**需要排除/调整的内容**：不动 fork 的移动 cyan 高亮逻辑（排除清单 #5）；`closeBoard` 会改写 q/C-c/Esc/Tab 退出路径（fork 当前在 board.ts:1399-1411、1521-1544 为内联 `clearFooterTimer(); screen.destroy(); resolve()`），需同步替换但保持 fork 的 screen 生命周期（tui.ts sharedProgram/unkey 包装）。

**迁移优先级**：A - fork web/配置已有该能力，TUI 缺位造成跨端不一致；改动集中且上游测试齐全（board-hide-empty-columns.test.ts）。

**迁移建议**：①直接复用 - `filterVisibleColumns` 与 toggle/closeBoard 逻辑为独立补丁；因 fork board.ts 当前 == 上游 38d6afa 版本，可先 apply 上游 board.ts 的 615 相关 hunks，再手工处理 fork 特有的 cyan 高亮区域。

---

## TUI-6：BACK-609 CLI/TUI 打磨缺陷（draft-113）

**任务核心目的**：修 4 个独立缺陷——`doc create` 缺 `--plain`、`doc list` legacy 文档名解析失效、TUI 退出不还原终端标题（tmux 兼容）、piped board 硬编码 "Project"。

**变更内容摘要**（merge 2f747cd，8 文件 +283/-22）：
1. `src/cli.ts`：`doc create` 注册 `--plain`（接受但输出本就是纯文本，对齐 `decision create --plain` 先例）。
2. `src/cli.ts`：`doc list` 交互分支弃用文件名匹配（只认顶层），改走 `core.getDocumentContent(selected.id)`（与 `doc view` 同一 reader，覆盖 legacy 纯标题文件名与子目录两种布局）。
3. `src/ui/tui.ts`：新增 `PUSH_WINDOW_TITLE`（`\x1b[22;0t`）/`POP_WINDOW_TITLE`（`\x1b[23;0t`）/`CLEAR_WINDOW_TITLE`（`\x1b]0;\x07`）+ `writeTerminalControl`（tmux DCS 直通，避开 blessed `_twrite` 在 Bun 下 5 秒轮询丢序列的问题）；`createScreen` 在设标题前 push、`destroy` 事件（once 标志防双发）先 clear 后 pop；`src/types/neo-neo-bblessed.d.ts` 补 `tmux`/`write` 声明。
4. `src/ui/board.ts`：piped 分支 `const projectName = options?.projectName?.trim() || "Project"`，看板标题用真实项目名（依赖 577 引入的 projectName）。

**与当前定制代码的交集风险**：中 - fork 4 处缺陷全部仍存在：① `cli.ts:3914-3931` `doc create` 无 `--plain` 选项；② `cli.ts:4046-4057` `doc list` 交互分支仍是旧 matcher（`f.startsWith(`${selected.id} -`) || f.endsWith(`/${selected.id}.md`) || f === `${selected.id}.md``），legacy/子目录文档选择后打开无内容（fork 有 `core.getDocumentContent`，`core/backlog.ts:534`）；③ `tui.ts:43-78` `createScreen` 无标题 push/pop——但 **fork 的 createScreen 有 sharedProgram + key/unkey 包装定制**（tui.ts:44-78），上游补丁是在函数头部/尾部加代码，需嵌入 fork 的包装结构，且 fork 无 `neo-neo-bblessed.d.ts` 中 `tmux`/`write` 声明；④ `board.ts:255-259` piped 分支硬编码 `"Project"`（`generateKanbanBoardWithMetadata(initialTasks, statuses, "Project")`），且 fork board options（board.ts:249-253）尚无 `projectName` 字段（需先随 TUI-3 引入）。

**适合迁移的内容**：doc create `--plain`（纯注册）；doc list 改 `getDocumentContent`（2 行替换 + 注释）；tui.ts 标题 push/pop（含 tmux DCS 直通方案与 once 防双 pop）；piped board 项目名。

**需要排除/调整的内容**：标题恢复与 TUI-3（formatTuiTitle）强耦合（都改 createScreen/title 语义），须同批迁移；且必须适配 fork 的 sharedProgram 生命周期（fork 通过 `sharedProgram` 跨屏复用，destroy 被包装，上游的 destroy 监听要验证不与 fork 的 unbind 逻辑冲突）。`neo-neo-bblessed.d.ts` 补声明按 fork 现有手写声明风格，勿整文件替换上游版本。

**迁移优先级**：A - 两处 CLI 缺陷（doc create 拒绝 --plain、doc list 打开空内容）是真实回归级 bug；标题还原是 TUI 基础卫生（fork 引入 577 后若不同步，退出会残留标题）。

**迁移建议**：②参考重写 - doc 两处修复①直接复用；tui.ts 标题管理按 fork 的 sharedProgram/unkey 包装手工适配（不能整文件覆盖 tui.ts）；piped 项目名依赖 577 的 projectName 字段，合并迁移。

---

## TUI-7：BACK-620 页脚过滤提示对齐（draft-121）

**任务核心目的**：统一看板与任务列表页脚/帮助弹窗的过滤键提示——统一大小写指示约定（大写=按该字母键，非 Shift 组合）与字母顺序（与 filter-header 渲染顺序一致），并把两条页脚字符串收敛到 footer-content.ts。

**变更内容摘要**：
- merge 22074f7（PR #892，7 文件 +114/-25）：`src/ui/footer-content.ts` 新增 `BOARD_FOOTER_CONTENT`（`[t/p/i/f] Filter`）与 `TASK_LIST_FOOTER_CONTENT`（`[s/t/p/i/l] Filter`）导出；`board.ts` `DEFAULT_FOOTER_CONTENT` 删除改 `const base = BOARD_FOOTER_CONTENT`；`task-viewer-with-search.ts` 内联字符串改 `TASK_LIST_FOOTER_CONTENT`；`help-popup.ts` 看板过滤行 `T/P/F/I` → `t/p/i/f`、任务列表行重排对齐。
- merge 981df36（PR #893，5 文件 +52/-37）：**反转指示约定**——恢复大写 `[T/P/I/F]` / `[S/T/P/I/L]`，但注释澄清「大写是按键指示，绑定键是小写字母」（Shift 字母实际以 `S-t` 形式送达，`["t","T"]` 绑定永不触发大写）；help-popup 行同步回大写。

**与当前定制代码的交集风险**：低 - fork 现状：`src/ui/footer-content.ts` 仅 `formatFooterContent`（54 行，无常量）；`board.ts:158-159` `DEFAULT_FOOTER_CONTENT` = `[P/F/I] Filter`（fork 无 Type 过滤，字母集与上游不同）；`task-viewer-with-search.ts:1062-1063` 内联 `[s/p/i/l] Filter`；`help-popup.ts:15-24` 看板行大写 `P/F/I`、`:26-41` 任务列表行小写 `s/p/i/l`——**fork 看板大写、列表小写的不一致与上游修前完全相同**。**必须适配**：fork 无任务类型体系，上游 `T`/`t` 字母不适用；fork 看板键集为 `P/F/I`（优先级/标签/里程碑），列表键集为 `s/p/i/l`（状态/优先级/里程碑/标签）。页脚键顺序应参照 fork `filter-header.ts` 的渲染顺序。

**适合迁移的内容**：把两条页脚字符串收敛到 `footer-content.ts`（BOARD_FOOTER_CONTENT/TASK_LIST_FOOTER_CONTENT）并让 board/task-viewer 引用；help-popup 过滤行与页脚一致；「大写=按键指示，绑定小写」的文档注释与约定（981df36 终版）。

**需要排除/调整的内容**：上游的 `T`/`t` 字母与 `ALL_FILTER_ITEMS` 顺序不直接适用（fork 无 Type）；不引入上游修前的中途态（小写指示），直接采用 981df36 终版约定。

**迁移优先级**：B - 纯文案/提示一致性（无功能缺陷），但修复真实存在的两视图不一致与「死键提示」误导；改动小。

**迁移建议**：②参考重写 - 把收敛位置（footer-content.ts）与 981df36 的大小写指示约定搬过来，字母集与顺序按 fork 的 P/F/I 与 s/p/i/l 定制。

---

## TUI-8：BACK-581 init 尊重 BACKLOG_CWD + BACK-605 TUI 经共享 core 用 runtime cwd（draft-98/110）

**任务核心目的**：让 `init` 与其他命令一致地解析 `--cwd`/`BACKLOG_CWD`（581）；让 TUI 各操作路径复用调用方 Core（runtime cwd 解析），消除散布的 `new Core(process.cwd())`（605）。

**变更内容摘要**：
- BACK-581（merge c87bbde，3 文件 +155/-20，`src/cli.ts` 28 行）：`requireProjectRoot` 拆出 `requireRuntimeCwd()`（`resolveRuntimeCwd()` 失败即退出、返回 `cwd`；`requireProjectRoot` 变为 `findBacklogRoot(await requireRuntimeCwd())`）；`init` handler `const cwd = process.cwd()` 改为 `await requireRuntimeCwd()`，description 注明 "(or BACKLOG_CWD when set)"。
- BACK-605（merge 7359267，12 文件 +320/-36）：`src/core/backlog.ts` 新增 `createRuntimeCore(options?)`：`resolveRuntimeCwd()` + `findBacklogRoot(cwd) ?? cwd`（无项目时回落原目录，调用方自行降级）。`board.ts`：options 增 `core?: Core`，内部 `getCore()` 惰性建 `fallbackCore`，7 处 `new Core(process.cwd(), { enableWatchers: true })` 全部替换为 `await getCore()`；`task-viewer-with-search.ts` `const core = options.core || (await createRuntimeCore({ enableWatchers: true }))`；`enhanced-views.ts`/`simple-unified-view.ts`/`unified-view.ts` 透传 `core: options.core`；`utils/status.ts`、`utils/task-path.ts`、`completions/data-providers.ts` 改 `createRuntimeCore`。

**与当前定制代码的交集风险**：中 - fork 已有 runtime-cwd 基础设施：`src/utils/runtime-cwd.ts`（`BACKLOG_CWD_ENV`/`resolveRuntimeCwd` 完整）；`cli.ts:464-474` `requireProjectRoot` **已使用** `resolveRuntimeCwd()`；`src/commands/help-schema.ts:155`、`src/commands/mcp.ts:36-41`、`src/mcp/server.ts:60` 已用 BACKLOG_CWD。**缺口 1（581）**：`cli.ts:697-698` init 仍是 `const cwd = process.cwd();`——`BACKLOG_CWD` 下 init 会初始化到错误目录；fork 无 `requireRuntimeCwd` 拆分。**缺口 2（605）**：fork 无 `createRuntimeCore`；残留 11 处裸 `new Core(process.cwd())`：`src/ui/board.ts` 7 处（946/1114/1208/1245 等）、`task-viewer-with-search.ts:188-189`、`src/utils/status.ts:8`、`src/utils/task-path.ts:171/361`、`src/completions/data-providers.ts:10`；`enhanced-views.ts:180` `new (await import(...)).Core(process.cwd())`。`unified-view.ts:448` renderBoardTui 已传 `createTask` 但未传 `core` 字段。

**适合迁移的内容**：`requireRuntimeCwd` 拆分 + init 换用（581 全量）；`createRuntimeCore`（605 全量）+ board `getCore()` 模式 + 各视图/工具函数替换。

**需要排除/调整的内容**：fork 的 `enhanced-views.ts:180` 是 `await import` 懒加载形态，替换时保留懒加载（或按上游改为 options.core 直传）。board.ts 的 7 处替换与 TUI-5（closeBoard）、TUI-6（piped projectName）、TUI-3（projectName）同文件重叠，建议同批迁移避免行号冲突。排除清单无直接条目。

**迁移优先级**：A - 581 是明确 bug（BACKLOG_CWD 下 init 行为错误）；605 修正 TUI 在 `BACKLOG_CWD`/`--cwd` 场景下所有变异操作落到 `process.cwd()` 的根偏差，属正确性修复。

**迁移建议**：②参考重写 - 581 的 `requireRuntimeCwd` 拆分与 init 改一行①直接复用；605 的 `createRuntimeCore` 原样搬入 `core/backlog.ts`，各调用面按 fork 行号逐个替换（board 7 处、task-viewer 1 处、utils 3 处、completions 1 处），与 TUI-3/5/6 的 board.ts 改动合并为一次迁移批次。

---

# 三、Web

## WEB-1：BACK-617 Fix web board drag-and-drop when hideEmptyColumns is enabled（draft-119）

**任务核心目的**：修复 `hideEmptyColumns` 开启时看板卡片完全无法拖拽的 bug——dragstart 事件内同步 reveal 空列会改变布局，Chromium 因而中止原生拖拽；改为把 reveal 延迟一个 macrotask，让浏览器先提交拖拽，隐藏空列随后以 drop 目标身份出现（诊断来自 PR #808）。

**变更内容摘要**（merge fda770a，3 文件 +293/-29：`src/web/components/Board.tsx` +39/-20、新测试 `src/test/web-board-drag-hidden-columns.test.tsx` +213、任务文档 +50）：
- Board.tsx 新增 `hiddenColumnsRevealed` state 与 `revealHiddenColumnsTimer` ref；
- `visibleStatuses` 的判定从 `isDragging`（同步）改为 `hiddenColumnsRevealed`；
- 新增 `cancelHiddenColumnsReveal`、`handleColumnDragStart`（`setTimeout(…, 0)` 延迟 `setHiddenColumnsRevealed(true)`）、`handleColumnDragEnd`（清 timer + 三个 state 复位），以及卸载清理 `useEffect`；
- 两处 `TaskColumn` 渲染点（里程碑 lane 模式与默认单 lane 模式）的 `onDragStart/onDragEnd` 从内联 setState 改为接 handler；
- 测试用 jsdom 证明「dragstart 不改变渲染列、隐藏列在下一 task 才到达、到达后成为 drop 目标」（真实浏览器验证由人工在 Chromium 完成）。

**与当前定制代码的交集风险**：低 - fork Board.tsx 与上游"before"完全同构：`fork:371-380` `visibleStatuses` 用 `isDragging = dragSourceStatus !== null` 同步判断（`fork:373` `if (!hideEmptyColumns || isDragging) return statuses;`），正是上游修复的 bug 模式；`fork:657-660` 与 `fork:695-700` 两处 onDragStart 内同步 `setDragSourceStatus/setDragSourceLane`。唯一差异点：fork 回调签名多一个 `taskId`（`fork:657`），并有第三个 state `draggedTaskId`（`fork:83`）——handler 迁移时须保留 `setDraggedTaskId(taskId)`（`fork:660,699`）与 onDragEnd 中的 `setDraggedTaskId(null)`（`fork:664,702`）。与排除清单无交集。

**适合迁移的内容**：Board.tsx 的整套状态机改动（`hiddenColumnsRevealed` state + timer ref + `cancelHiddenColumnsReveal`/`handleColumnDragStart`/`handleColumnDragEnd` + `visibleStatuses` 判定替换 + 两处接线 + deps 数组）。上游测试的断言思路可移植，但需按 fork 的 Board props 与 Task 类型重写 fixture。

**需要排除/调整的内容**：① 上游 handler 不带 `taskId`，fork 需包一层保留 `setDraggedTaskId`（对应 `fork:660/699`），否则 fork 的拖拽高亮/幽灵卡片状态回归；② onDragEnd 需同时复位三个 state（上游只复位两个）；③ 上游测试文件不直接照搬。

**迁移优先级**：A - 真实 bug 修复，上游诊断清晰、修复面极小（单文件 39 行），fork 代码模式与上游逐行对应（`fork:371-380` vs 上游旧逻辑；`fork:657-660/695-700` vs 上游旧 onDragStart），bug 在 fork 上同样存在（Chromium 中止原生拖拽），且不触碰任何 fork 定制能力。

**迁移建议**：①直接复用 - handler 逻辑逐行照搬，仅外层包一层适配 fork 的 `taskId` 参数与 `draggedTaskId` 清理。

---

## WEB-2：BACK-593 Auto-link task IDs in web markdown to task deep links（draft-104）

**任务核心目的**：web markdown 中的裸任务 ID 自动渲染为任务深链、依赖 chips 可点击跳转；通过 remark 插件（mdast 结构化遍历，结构上排除行内代码/代码块/已有链接）加"基于已加载任务语料的 canonical ID 索引"做到 fail-closed：UTF-8、ISO-8601、v1.2.3、长 ID 尾部、未知 ID 一律不链接，大小写/补零变体归一到 canonical href；未知依赖 chip 渲染为纯文本。

**变更内容摘要**（merge 5cc69b6，10 文件 +735/-22；补充 commit 3bc2d3c 仅任务文档 +44）：
- 新 `src/web/utils/task-id-links.ts`（+118）：`TASK_ID_CANDIDATE` 正则、`PRECEDING_REJECT`/`FOLLOWING_REJECT` 边界守卫、`SKIPPED_NODES = {link, linkReference, definition}`、`buildTaskIdIndex`（canonical 冲突删除而非后写覆盖，对齐路由层拒绝歧义 ID）、`resolveTaskReference`、`createTaskIdLinkPlugin`（remark 插件，`index.size === 0` 时跳过）；
- 新 `src/web/contexts/TaskIdIndexContext.tsx`（+21）：Provider + `useTaskIdIndex`；
- `src/web/App.tsx`（+3）：`<TaskIdIndexProvider tasks={tasks}>` 包裹；
- `src/web/components/MermaidMarkdown.tsx`（+12/-2）：`useTaskIdIndex()` + `useMemo` 构造 `remarkPlugins` 传入 `MDEditor.Markdown`；
- `src/web/components/DependencyInput.tsx`（+35/-10）：`getTaskDisplay` 精确 find 改为 `buildTaskIdIndex(availableTasks)` + `resolveTaskReference`（canonical 解析、歧义不链接），chip 标签改 `<Link to={/tasks/${dependency.id}}>`，未知 chip 纯文本，`CHIP_LABEL_CLASS` 常量；
- `src/web/components/TaskDetailsModal.tsx`（+34）：新增 `hasUnsavedEdits` 与 `confirmNavigationAwayFromEdits`（`onClickCapture` 守卫：模态内链接点击携带未保存编辑时 `window.confirm`，上游硬编码英文 "Discard unsaved changes and leave this task?"）；
- 测试：`mermaid-markdown.test.tsx`（+108）、`web-dependency-input-links.test.tsx`（+60）、`web-task-details-modal-unsaved-navigation.test.tsx`（+271）；
- 范围相关 commit：e59fcff（BACK-599，**仅创建 backlog 任务文档**，无代码——记录两个后续缺口：完成态任务不在语料内导致引用不链接/歧义路由 409、链接丢失返回路由与 search 参数；依赖 BACK-260 产品决策）；0fbfd50/127c976（测试基建：`src/test/react-dom-input.ts` helper + 若干 web 测试在 `bun test --isolate` 下输入丢失的修复，仅动测试文件）。

**与当前定制代码的交集风险**：中 - fork 无 `task-id-links`/`TaskIdIndexContext`（grep 为空）→ 纯新增能力，无覆盖冲突；fork 身份解析工具已具备：`src/utils/task-path.ts` 的 `canonicalTaskId`（大小写+补零归一无歧义，语义与上游 `utils/task-id.ts` 一致）。fork `MermaidMarkdown.tsx` 是重定制版本（`fork:558-563` `MDEditor.Markdown` 已用 `components`（自定义 LinkComponent）+ `rehypePlugins`；含 wikilink 体系、图片灯箱、mermaid 渲染）。集成点干净（只加 `remarkPlugins` prop），但**路由差异是关键**：上游插件生成 `/tasks/<id>`（复数），fork 路由是 `task/:id`（`fork App.tsx:848`），且 fork `parseLocalUrl`（`MermaidMarkdown.tsx:190-196`）只识别 `/^\/task\//`（单数）——若照搬 `/tasks/` href，链接不会走 fork 的 `onTaskClick` 分支（`fork:401-407`）而落入外部链接处理。fork `DependencyInput.tsx` 已有等价点击机制：chip 用 `onTaskClick` 回调按钮（`fork:130-138`），`TaskDetailsModal.handleTaskClick`（`fork:348-357`）导航 `/task/<id>` 或 onDrillDown。未保存编辑守卫：fork 只有 `isDirty`（`fork:411`）、关闭时仅 edit 模式确认（`fork:986`）——没有链接点击守卫；移植 auto-link 后需同带守卫，且上游 confirm 文案是硬编码英文，fork 必须走 i18n（`src/web/locales/en.ts:237` 有 `discardAndClosePrompt` 可类比，需给 en/ja/zh-CN/zh-TW 4 个语言文件新增 key）。与排除清单：#6 WebSocket 推送（fork 已有）恰好是上游测试验证的"任务创建后索引实时更新"的支撑，不冲突。

**适合迁移的内容**：① `task-id-links.ts` 全部逻辑（正则、边界守卫、SKIPPED_NODES、canonical 索引、remark 插件）——import 从上游 `utils/task-id.ts` 换为 fork `utils/task-path.ts` 的 `canonicalTaskId`；② `TaskIdIndexContext` + App 包裹（fork 的 AppContent return 在 `fork App.tsx:749`，`Routes` 在 780，`tasks` 已在作用域内）；③ MermaidMarkdown 的 `remarkPlugins` 接线；④ DependencyInput 的 canonical 解析与未知 chip 纯文本；⑤ `confirmNavigationAwayFromEdits` 守卫（i18n 化）。BACK-599 文档记录的两个缺口（完成态语料、返回路由保留）应作为后续项在实现时避免引入同样的链接丢参数问题。

**需要排除/调整的内容**：① href 必须用 fork 路由 `/task/${task.id}`（或同步扩展 `parseLocalUrl` 支持 `/tasks/`，二选一，推荐前者以贴合 fork 路由体系）；② confirm 文案 i18n（上游硬编码英文，fork 需新增 4 个 locale key）；③ `canonicalTaskId` 的 import 路径换成 fork 的 `utils/task-path.ts`；④ 0fbfd50/127c976 测试基建仅当移植上游测试时评估，fork 测试体系独立，不建议直接照搬；⑤ e59fcff 本身无代码，不迁移（其 AC 依赖 BACK-260 产品决策）。

**迁移优先级**：A - 新增能力无覆盖冲突、fork 身份解析工具已齐备、集成点明确（MermaidMarkdown 的 remarkPlugins、DependencyInput 的 onTaskClick、TaskDetailsModal 的 handleTaskClick）；风险集中在路由/i18n 两处适配，均可控；上游已附带 14 个组件测试与浏览器验证。守卫部分是 auto-link 的必要伴生，必须同批迁移。

**迁移建议**：②参考重写 - 核心算法文件（task-id-links.ts）可直接复用，接线层（href 路由、LinkComponent 协同、i18n 守卫、DependencyInput 保持 onTaskClick 按钮形态）按 fork 结构重写；测试按 fork 约定重写。

---

## WEB-3：BACK-621 Make the web task list fit without horizontal scroll and trim page padding（draft-122）

**任务核心目的**：消除任务列表表格恒宽 1568px 导致的横向滚动（`table-layout: fixed` 下表格宽度 = 声明宽度与列宽之和的较大者，`w-full` 永不生效），并用 `.page-shell` 替换 Tailwind `container`（max-width 按视口断点而非内容区，侧栏折叠时产生 77px 级留白）；附赠过滤行换行修复、站点滚动条样式、模态边框。

**变更内容摘要**（merge 8e51726 单 commit squash，9 文件 +285/-39；扩展 commit bdd2594/43d5b09/b8d41ad/9ed7091 均只改 backlog 任务文档，无代码）：
- `TaskList.tsx`（+26/-20）：单一宽度源 `TASK_COLUMN_WIDTHS_REM = [6, null, 6.5, 6.5, 6, 8, 6.5, 8, 6]`（Title=null 弹性吸收余量），`TASK_TABLE_MIN_WIDTH_REM` 由列表推导（65.5rem）替换硬编码 `min-w-[1100px]`；`renderColumnGroup` 改读常量；页根 `container mx-auto px-4 py-8` → `page-shell`；过滤行：Clear filters 按钮从"常驻 `visibility:hidden` 占位"改为 `hasActiveFilters` 条件渲染（删 visibility/aria-hidden），status/priority select `min-w-[140px]`→`[120px]`；
- `src/web/styles/source.css`（+49）：`html { scrollbar-color: <thumb> transparent }`（可继承）+ 全元素 `scrollbar-width: thin` + `::-webkit-scrollbar` 回退（浅色 thumb 0.22 / 深色 0.2，带 hover）；`.page-shell { width: 100%; padding: 1.5rem 1rem }`；已验证 `.scrollbar-hide` 因在更晚层叠层仍计算 `scrollbar-width: none`；
- `BoardPage.tsx`（-1）、`DraftsList.tsx`（-1）、`MilestonesPage.tsx`（-1）、`Settings.tsx`（-3）页根 container → page-shell；
- `Modal.tsx`（-1）：`shadow-2xl` 上补 `border border-gray-200 dark:border-gray-600`（暗色背景下原 shadow 不可见）；
- 测试 `src/test/web-task-list-table-width.test.tsx`（+138）。

**与当前定制代码的交集风险**：中 - fork TaskList 与上游"before"逐行同构：`fork:543-550` colgroup 硬编码宽度（8+28+8+7+11+11+11+7 = 91rem，少上游的 Ordinal 列）、`fork:643` container、`fork:764/782` `min-w-[1100px]`、`fork:724-727` 常驻隐藏 Clear filters 按钮、`fork:674` priority select `min-w-[140px]`、`fork:733` 计数 `min-w-[170px]`。**列差异**：fork 8 列（ID/Title/Status/Priority/Labels/Assignee/Milestone/Created，无 Ordinal）→ 宽度数组须删掉 Ordinal 的 6rem 项。**过滤行差异**：fork 多 `StatusExcludeDropdown` 与 milestone select（`fork:686` `min-w-[160px]`），上游的数值结论基于上游控件集，fork 需按自身控件重新测量；`min-w` 调减只适用 priority select（`fork:674`），milestone select 保留。fork 页根 container 恰在同 5 文件 7 处（`BoardPage.tsx:134`、`DraftsList.tsx:248`、`MilestonesPage.tsx:949`、`Settings.tsx:122/132/141`、`TaskList.tsx:643`），与上游改动集一致；GanttView/Statistics 不用 container，排除清单 #3/#4 不受影响。fork `source.css` 独立定制（`fork:95` `.scrollbar-hide { scrollbar-width: none }`），追加 scrollbar/page-shell 需确认层叠顺序不覆盖 `.scrollbar-hide`。

**适合迁移的内容**：① TaskList 单一宽度源 + 派生 `min-width`（按 fork 8 列适配 `[6, null, 6.5, 6.5, 8, 6.5, 8, 6]`）；② Clear filters 条件渲染（删 `fork:724-727` visibility 常驻）；③ `.page-shell` 替换 7 处 container；④ `Modal.tsx:48` 补边框；⑤ 站点滚动条样式（评估 fork 层叠后）；⑥ 上游测试断言思路（表格宽度 ≤ 内容区、`documentElement` 无横向溢出）参考重写。

**需要排除/调整的内容**：① 列宽数组按 fork 8 列调整（删 Ordinal 项），上游 9 列清单不照抄；② `min-w` 120px 调整仅限 priority select（`fork:674`），milestone select（`fork:686`）与 StatusExcludeDropdown 不在上游改动面，需按 fork 实测；③ 上游过滤行 px 数值不可直接引用（控件集不同）；④ b8d41ad/9ed7091/bdd2594/43d5b09 无代码（仅任务文档）。

**迁移优先级**：A - fork 页面结构与上游"before"完全对应，缺陷（表格恒宽溢出、container 留白、过滤行空带）在 fork 同款存在（`fork:543-550/643/764/782/724-727`）；纯布局/CSS 改动，不触碰任何定制能力；改动面机械（同一套 5 文件 7 处 + 1 个 CSS 追加），风险低。

**迁移建议**：②参考重写 - 方案（单一宽度源、派生 min-width、条件渲染 Clear filters、page-shell、Modal 边框）直接采用，具体列清单按 fork 8 列重算、过滤行数值按 fork 控件集实测；滚动条样式视 fork 层叠结构取舍后并入。

---

## WEB-4：BACK-614 web create 表单显式 unassign（merge 6ff29d8，PR #886）+ BACK-604 CLI/TUI 显式 unassign（merge 04fa805，PR #880）（draft-109）

**任务核心目的**：让"显式未分配"在各表面可表达——确立单一规则：**absent（字段缺席）= 无意见**（create 时 defaultAssignee 生效 / edit 时保留现值），**显式空 `[]` = 明确未分配**。BACK-604 修核心与 CLI/MCP 各表面（`-a ""` 不再坍缩为 absent）；BACK-614 让 web create 表单用 defaultAssignee 预填 chips，清空 chips 即发送显式 `assignee: []`。

**变更内容摘要**：
- 04fa805（16 文件 +206/-26）：`src/core/backlog.ts` `createTaskFromInput` 默认值判定从"normalized 列表为空"改为 `input.assignee === undefined`；`src/utils/task-builders.ts` 新 `parseClearableStringList`（absent→`undefined`，显式空→`[]`）；`src/utils/task-edit-builder.ts` `normalizeStringList` → `sanitizeClearableStringArray`，edit 的显式 `[]` 不再被丢弃（修复 MCP `task_edit assignee: []` 无效果）；`src/cli.ts` `task create`/`draft create`/`task edit` 的 `-a` 改用 `parseClearableStringList`；edit 的 `if (assigneeValues.length > 0)` → `if (assigneeValues)`；帮助文案注明 `-a ""` 语义；`src/mcp/utils/schema-generators.ts` assignee description 注明"传空数组 = 未分配/清空"；`src/web/components/TaskDetailsModal.tsx` create 模式空 assignee 省略字段（让 default 生效）；测试 +11 文件。
- 6ff29d8（4 文件 +372/-16）：`src/web/App.tsx` 传 `<TaskDetailsModal defaultAssignee={config?.defaultAssignee}>`；`TaskDetailsModal.tsx` 新 prop `defaultAssignee?: string[]`；`createModeAssignee = useMemo(() => isCreateMode ? (defaultAssignee ?? []) : [], ...)`；`buildTaskDetailsFormState` 增加 `createModeAssignee` 参数；`hasCreateModeEntries` 的 assignee 判定改 `!areJsonEqual(assignee, createModeAssignee)`（预填默认不算用户改动）；submit 载荷：`isCreateMode && assignee.length === 0 && createModeAssignee.length === 0 ? {} : { assignee }`。

**与当前定制代码的交集风险**：高（fork 语义基线不同——无 defaultAssignee 应用）。
- fork 全仓 `defaultAssignee` 仅存在于配置面：`src/types/index.ts:331`、`src/file-system/operations.ts:1444/1561/1593`；**core/CLI/web 均无应用逻辑**（`src/core/backlog.ts:1031` `const normalizedAssignees = normalizeStringList(input.assignee) ?? [];` 无 fallback，`fork:1092` `assignee: normalizedAssignees` 直接落盘）。
- fork web create 载荷**始终**带 `assignee`（`TaskDetailsModal.tsx:786`），空数组即未分配——fork 当前语义已天然等价"显式空 = 未分配"（因为没有默认值可应用）。
- fork CLI 选项结构不同：`-a` 是单值无 accumulator（`cli.ts:1656` create / `2638` edit / `3377` draft create），`fork:1769/3392` `options.assignee ? [String(options.assignee)] : undefined`——`-a ""` 为 falsy → undefined，与 absent 同义；`fork:2968-2970` edit 的 `if (assigneeValues.length > 0)` 丢弃空数组。
- fork `task-edit-builder.ts:75-77`：`const assignee = normalizeStringList(args.assignee); if (assignee) { updateInput.assignee = assignee; }`——显式 `[]` 被丢弃 → **MCP `task_edit assignee: []` 与 CLI `task edit -a ""` 均无法清空 assignees**（web PUT 路径 `core/backlog.ts:1373-1376` 可以清空，是唯一可清空表面）。
- fork web 已加载 config（`App.tsx:212/358`），类型含 `defaultAssignee`，传 prop 在技术上无阻碍。
- 排除清单：无直接冲突；注意与"空字符串清除"条目的边界——unassign 是数组语义而非字符串空值清除，不冲突。

**适合迁移的内容**：① `task-edit-builder.ts:75-77` 的"显式空不清零丢弃"修复（对应上游 `sanitizeClearableStringArray`）——让 MCP/CLI edit 传 `[]` 真正清空 assignees，这是独立于 defaultAssignee 的真实小修复；② `cli.ts:2968-2970` 的 `if (assigneeValues)` 判断同步修正；③ 若未来 fork 引入 defaultAssignee 应用能力，04fa805 的 core 判定（`undefined` vs `[]`）与 6ff29d8 的 web 预填（`createModeAssignee` + 载荷三态）是配套方案，可整体移植。

**需要排除/调整的内容**：① 上游核心语义"absent → defaultAssignee 生效"在 fork 无 defaultAssignee 场景下无意义——`createTaskFromInput` 判定改动现在移植会引入死分支，应等 defaultAssignee 应用能力落地时一并做；② `parseClearableStringList` 同理，其价值只在"默认值应用"存在时成立，且 fork CLI 的 `-a` 无 accumulator，移植前需先对齐 CLI 选项结构；③ web 预填（6ff29d8）**不能单独移植**：若 UI 预填了 chips 而 core 不应用 default，会造成"表单显示默认人、保存后无默认人"的错位——必须与 defaultAssignee 应用同批；④ schema-generators 描述文案不适用；⑤ 上游 11 个测试文件与 fork CLI 结构差异大，仅参考断言思路。

**迁移优先级**：B（局部）- 当前 fork 无 defaultAssignee 应用，BACK-604/614 的主要动机场景不存在；唯一可独立受益的是 edit 清空 assignee 的小修复（`task-edit-builder.ts:75-77` + `cli.ts:2968-2970`），属于小而真实的能力缺口（现仅 web PUT 可清空）。web 预填与 core 语义改造应随 defaultAssignee 特性整体评估，暂列 C。

**迁移建议**：②参考重写（仅取 edit 显式空清空两处小改动，按 fork 的单值 `-a` 结构重写为 fork 风格的 `parseDelimitedStringList` 变体或等效判断）；③忽略其余部分，直至 fork 引入 defaultAssignee 应用（届时按 04fa805 + 6ff29d8 组合迁移）。

---

# 四、Server / 核心身份

## SVR-1：BACK-580 文档/决策身份 fail-closed + BACK-602 doctor 与 web 缺口（draft-97/107）

**任务核心目的**：让文档（doc）与决策（decision）的身份解析与任务侧对齐——等价 ID 命中多个文件时 fail-closed（抛歧义错误而非静默按 title 排序取第一个），空字符串 ID 不可解析，doctor 覆盖文档/决策诊断，server/MCP/web 对歧义给出 409 / AMBIGUOUS_ID / 可读提示；并补上目录不可读与 web create 路由残留歧义提示两个 review 缺口。

**变更内容摘要**：
- **merge 900ff97（BACK-580，24 文件）**：
  - 新增 `src/utils/entity-id.ts`（72 行）：`AmbiguousIdError`、`entityIdKey`（前缀剥离 + 空体返回 null + 数字去零归一）、`normalizeEntityId`、`entityIdsEqual`、`findUniqueEntityById`；`src/utils/task-path.ts` 的 `AmbiguousTaskIdError` 改为继承 `AmbiguousIdError`；
  - `src/utils/document-id.ts` 重写为基于 entity-id，新增 `findDocumentById`；新增 `src/utils/decision-id.ts`（20 行）；`src/utils/duplicate-detection.ts` 新增 `ContentIdentityIssues`/`detectContentIdentityIssues`/`hasContentIdentityIssues`；
  - `src/core/backlog.ts`：新增 `diagnoseContentIdentity()`；`getDocument` 改用 `findDocumentById`；
  - `src/file-system/operations.ts`：`loadDecision` 重写为 `findDecisionById(await this.listDecisions(), decisionId)`（删除 filename-prefix 匹配）；`listDecisions`/`listDocuments` 新增 `unreadable` 收集参数；`loadDocument` 改用 `findDocumentById`；
  - `src/core/content-store.ts`：decisions watcher 3 处 `parseDecision` 结果注入 `path`；`src/types/index.ts` 的 `Decision` 新增 `path?: string`；
  - `src/server/index.ts`：4 处 `isAmbiguousIdError` → 409；`handleGetDecision` 改为 `core.filesystem.loadDecision`（绕开 store 的原始 ID key 静默去重）；
  - `src/cli.ts`：doctor 集成 `diagnoseContentIdentity` + `printContentIdentityReport`，content identity 问题 exit 1 且不进入 `--fix` 自动修复；`doc view` catch 中 `isAmbiguousIdError` → 打印完整歧义消息 exit 1；
  - `src/mcp/errors/mcp-errors.ts`：`isAmbiguousIdError` → `AMBIGUOUS_ID` + candidates；
  - `src/markdown/parser.ts`：`matter(toParse, {})` 绕过 gray-matter cache 中毒（与 CLI-12 同根）；
  - web：`src/web/lib/api.ts` 新增 `toApiError` + `isAmbiguousIdConflict`（status===409）；新增 `AmbiguousIdNotice.tsx`（21 行）；`DocumentationDetail`/`DecisionDetail` 歧义时不再 fallback 到 props 缓存条目；
  - 测试 6 个：`content-identity.test.ts`（新 220 行）、`server-documents-endpoint.test.ts`（新 127 行，409 + 字节未动证明）、`web-ambiguous-id.test.tsx`（新 122 行）、`cli-doctor.test.ts`（+147）、`markdown.test.ts`（+12）、`mcp-documents.test.ts`（+21）。
- **merge cf0ca9c（BACK-602，9 文件）**：目录级不可读也报 finding——`operations.ts` 新增 `recordUnreadableDirectory`，`listDecisions`/`listDocuments` 的 catch 改记录，`backlog.ts` `locate` 空路径表示目录本身，`cli.ts` 文案；`DecisionDetail`/`DocumentationDetail` create 路由先 `setError(null)` + `setDocument(null)`（消除 409 后跳转 create 时残留歧义提示）。

**与当前定制代码的交集风险**：**高**
- `src/utils/document-id.ts` 调用方众多（saveDocument 清理、getDocument、content-store 等），迁移后 `documentIdsEqual` 语义不变但需核对全部调用；`src/file-system/operations.ts` 是 fork 深度定制核心：fork `loadDecision`（operations.ts:801-818）仍为 filename-prefix 匹配（`file.startsWith('decision-${normalizedId} -')`，line 812），返回值带 fork 自有的 `filePath`（绝对路径，types/index.ts:206），与上游新增的 `path`（相对路径）字段体系不同；
- `src/server/index.ts`：fork 已有 BACK-567 移植的 `AmbiguousTaskIdError` 409 处理（server/index.ts:1116-1117、1131-1132、897-898），fork 的 `AmbiguousTaskIdError`（core/backlog.ts:119-124）是独立类、不继承 `AmbiguousIdError`；统一 `isAmbiguousIdError` 判断需决策（见排除②）；
- web 组件 fork 已演进（i18n、slug 路由、saveError 状态）：fork `DocumentationDetail.tsx:106` 是 `const [, setError]`（setter 被丢弃的死代码，上游对应行已有 error state 渲染）；`DecisionDetail.tsx:96-103` 无 error state（失败仅 console.error），上游 diff 上下文无法直接 apply。

**适合迁移的内容**：新增模块整体复用：`entity-id.ts`、`decision-id.ts`、`duplicate-detection.ts` 的 ContentIdentity 扩展（纯新增，零调用方冲突）；`document-id.ts` 接入 `findDocumentById`/`entityIdKey`；`backlog.ts` `getDocument`（fork 现状 backlog.ts:528-532 为 `documents.find(documentIdsEqual)`，无 fail-closed）改用 `findDocumentById`；doctor 集成：fork doctor（cli.ts:4903-5006）目前只做任务重复 ID 诊断/修复，按上游模式追加 content identity 诊断（exit 1、不进 --fix）；server 409：fork `handleGetDoc`（server/index.ts:1358-1369）、`handleGetDecision`（1620-1627）、`handleUpdateDoc`（1550）、`handleUpdateDecision`（1647）目前 catch 全部转 404/500，需补 `isAmbiguousIdError` → 409 分支；`parser.ts:140` 的 `matter(toParse)` cache 修复（本改动一行可先行）；web `toApiError`/`isAmbiguousIdConflict` + `AmbiguousIdNotice`：fork api.ts:456/464/472/494/516/524/532/546 共 8 处 `throw new Error(...)` 无 server 消息透传；mcp `AMBIGUOUS_ID` 映射。

**需要排除/调整的内容**：① **Decision.path 字段体系**：上游用相对 `path`，fork 用绝对 `filePath`（types/index.ts:206）且 decisions watcher 注入的是 fork 自有结构——`findDecisionById` 的 describe 回调（歧义消息列文件）需用 fork 的 `filePath`/文件名，不照搬 `path ?? title`；② **AmbiguousTaskIdError 继承重构不强制**：fork 任务侧 fail-closed 已落地；若只迁文档/决策侧，可新增 `isAmbiguousIdError` 并让 server 判断改为 `instanceof AmbiguousTaskIdError || isAmbiguousIdError` 双分支；若后续想统一，再让 fork 的 `AmbiguousTaskIdError` 继承 `AmbiguousIdError`；③ **web 组件参考重写**：fork `DocumentationDetail.tsx:106` 的 `[, setError]` 死代码 + 无 error 渲染结构需按 fork 现有模式重写，不直接 apply 上游 diff；create 路径清错误（BACK-602）需在 fork 的 useEffect 结构（`id === 'new'` 分支）内落地；④ doctor 的 `--fix`/`--rollback`/`plan.repairable` 语义保持 fork 现状（只针对任务），content identity 仅诊断（exit 1）。排除清单核对：不触碰里程碑 actual 字段、任务日期 UTC、空字符串清除、甘特图、统计页面、WebSocket 推送 → 无回退风险。

**迁移优先级**：**A** - 上游修复两个公开 bug（等价 ID 静默按 title 排序解析、缺 id frontmatter 的文档列出但不可寻址）；fork 文档/决策侧完全缺失该能力（无 entity-id.ts/decision-id.ts）；且 SVR-2 证明 fork 文档 watcher 的等价 ID 处理会放大歧义面；doctor/server 缺口补齐成本低、收益明确、有完整对抗性测试可作验收。

**迁移建议**：①直接复用（entity-id.ts / decision-id.ts / duplicate-detection 扩展 / parser cache 修复 / mcp 映射）+ ②参考重写（operations.ts / backlog.ts / server / cli doctor / web 组件需适配 fork 的 filePath 字段、现有 409 结构与组件形态）。

---

## SVR-2：BACK-613 content-store 文档 watcher 重试/重命名（draft-116）

**任务核心目的**：修复 content-store 文档 watcher 的身份处理——无标题文件名（`doc-1.md`）永不收敛（id 推导带 .md 扩展名导致重检链死循环）、padding 等价文件名（`doc-0001` vs `doc-01`）对账失效，外加 review 发现的 4 个 case：并发刷新复活、等价兄弟误删、过期重检删活文件、重命名+改 ID 同时发生。

**变更内容摘要**（merge a2c6746，3 文件）：
- `src/core/content-store.ts`（+106/-38）：新增 `documentFilenameId()`（`basename(name, ".md").split(" - ")[0]` + `documentIdKey` 门控，空体/无前缀返回 null → 兜底全量刷新）与 `watchedDocumentPath()`；watcher 条目改按路径寻址——`findWatchedDocumentByPath`/`dropWatchedDocument`（删除也 version 化，防并发刷新复活）/`publishWatchedDocument` 重写（返回 strandedEquivalent 标志 → 触发全量刷新）；rename 分支 filename-vs-frontmatter 比较全部改用 `documentIdsEqual`，`current`/`remove` 改按 eventPath；
- `src/test/content-store.test.ts`（+347）：7 个对抗性用例（untitled settle 断言发布且 `deferredRechecks.size === 0`、padded/unpadded rename+删除、frontmatter padding 变更、gated-refresh 复活、padding-equivalent siblings、stale recheck 对 live document、rename-with-respell）。

**与当前定制代码的交集风险**：**高** - 同文件 `src/core/content-store.ts` 是 fork 深度定制核心且架构不同：fork 用 `retryRead`（content-store.ts:1028-1052，单事件内 12 次 × 75ms 递增延迟 + 失败回退 `refreshDocumentsFromDisk`），上游是 `deferredRechecks`/`reconcileOrSchedule` 延迟重检链 → 上游 diff 无法直接 apply，必须按 fork 架构改写。fork 文档 watcher 现状（content-store.ts:588-647）逐项对照上游修复点：
- **缺陷 1（doc-1.md 永不发布）fork 同根存在**：fork line 594 `const [idPart] = base.split(" - ")`，base 来自 `basename(absolutePath)` 含 ".md" → `doc-1.md` 得 `idPart = "doc-1.md"` ≠ frontmatter `doc-1` → retryRead isValid（line 619-638 区域 `result.id !== idPart`）永远 false → 12 次耗尽 → 带参 `refreshDocumentsFromDisk("doc-1.md", ...)` 的 `doc.id === "doc-1.md"`（line 833 严格相等）也失败 → 事件静默丢失；
- **缺陷 2（padding 等价对账失效）fork 同根存在**：fork watcher 用原始字符串 key（`documents.has(idPart)` line 604、`documents.get(idPart)`、`documents.set(document.id, ...)` line 646），`doc-0001 - Title.md`（frontmatter doc-1）与 `doc-01 - Title.md`（frontmatter doc-1）条目互相覆盖（后事件胜），删除分支 `has("doc-0001")` 对已按 doc-1 key 存储的条目失效 → 残留；
- **rename 分支**：fork 对 `rename && exists` 直接全量刷新（line 609-613）→ rename+respell case 天然兜底（上游的 strandedEquivalent 机制 fork 不需要）；
- **并发刷新复活（上游 case 1）**：fork 有 BACK-568 移植的 `captureVersions`/`mergeDocuments` 版本合并体系，删除分支已有 `incrementDocumentVersion`（line 604）——但 padding 等价时 key 不匹配，version 化形同虚设；
- `refreshDocumentsFromDisk` 的 expectedId 匹配（fork line 833 `doc.id === expectedId`）是核心差距：上游修复后该路径用 `documentIdsEqual`。

**适合迁移的内容**：`documentFilenameId()` 推导逻辑（`basename(name, ".md")` 再去 `split(" - ")`）——修复 fork 缺陷 1 的最小改动；watcher 内 filename-vs-frontmatter 比较改用 `documentIdsEqual`（fork 的 watcher 目前全部 ===/原始 key）；删除路径按 path 寻址（`findWatchedDocumentByPath` 思路）——修复 fork 删除残留；`refreshDocumentsFromDisk` 的 expectedId 匹配改用 `documentIdsEqual`（fork content-store.ts:833）；上游 7 个测试用例可直接作为 fork 移植后的验收标准。

**需要排除/调整的内容**：① **不移植 deferredRechecks/reconcileOrSchedule 重检链**：fork `retryRead` + 全量兜底已是等价架构（BACK-568 移植的快照/版本并发合并），引入两套重试机制会造成维护双轨；只把 documentFilenameId/documentIdsEqual/path 寻址修进现有 retryRead 流程；② rename 分支维持 fork 的全量刷新兜底（line 609-613），不照搬上游 `publishWatchedDocument` 的 strandedEquivalent 返回值机制；③ 上游明确 out-of-scope 的 `updateDocumentFromDisk` 原始 key 查找（`documents.get(documentId)`）在 fork 同样存在（fork content-store.ts:919-925），fork 一并保持现状；④ fork 的删除分支 version 化沿用 `incrementDocumentVersion` 命名，不照搬上游 `nextContentItemGeneration`/`nextContentItemVersion`。排除清单核对：不涉及里程碑/日期/空串/甘特/统计/WebSocket；本修复强化 fork 已移植的 watcher 驱动广播（BACK-568 体系）正确性，与之兼容。

**迁移优先级**：**A** - fork 文档 watcher 存在与上游同根的 3 个实际缺陷（doc-1.md 事件静默丢失、padding 等价覆盖/删除残留、refresh 兜底 === 失效），直接影响 fork 已落地的 watcher 驱动广播体验（保存/删除文档后 UI 不更新或残留），且与 SVR-1 的 fail-closed 目标互相强化（等价 ID 在 store 层先于 server 层被处理）；上游 7 用例为现成验收标准。

**迁移建议**：②参考重写 - 按 fork retryRead 架构移植修复（documentFilenameId / documentIdsEqual / path 寻址三点），不可直接 apply 上游 diff；测试用例 ①直接复用（改为适配 fork 的 retryRead 语义与命名）。

---

# 五、Infra / CI

## CI-1：BACK-585 ubuntu CI epoll 抖动（draft-102）

**任务核心目的**：消除 ubuntu-latest 上 bun test 偶发整文件无征兆中止（`epoll_ctl EEXIST`，约 4/6 次运行）——根因：test-preload 在每个测试 realm 导入 jsdom，`--parallel` worker 下各 realm 惰性构造 `process.stderr` 的 epoll 注册与残留注册冲突（Linux 专属，kqueue/IOCP 幂等），Bun 报为不可捕获错误杀死整个文件。

**变更内容摘要**：
- **b79fa3a（诊断 commit，1 文件）**：任务文档 58 行，记录根因探针（/proc fdinfo 验证 worker 内注册冲突）；
- **merge 0065f43（BACK-585，4 文件）**：`src/test/test-preload.ts`（+10/-1）：jsdom preload 改为 env 门控，非 DOM pass 跳过 jsdom 导入；`scripts/run-ci-tests.ts`（+59/-13）：两遍式——非 DOM 文件保持 `--parallel=2` + preload 关 jsdom；jsdom 依赖文件（内容扫描自动推导，无硬编码清单）单进程串行 pass 写 `test-results-dom.xml`；`.github/workflows/ci.yml`（+3/-1）：artifact glob `test-results.xml` → `test-results*.xml`；任务文档（+52）；上游自评 ~15% 提速（~198 个 realm 不再导入 jsdom）。上游结论：任务保持 In Progress 至 ~6 次连续绿色；未上报 Bun issue。

**与当前定制代码的交集风险**：**低** - fork **无** `src/test/test-preload.ts` / `react-dom-preload.ts`（glob 确认不存在）→ 无 preload 全局注入机制，上游根因的第一前提（"preload imports jsdom into every test realm"）不成立；fork **无** `scripts/run-ci-tests.ts`；fork ci.yml 的 ubuntu 分支直接 `bun test --timeout=10000 --reporter=junit --reporter-outfile=test-results.xml`（无 `--parallel=2`；仅 Windows 用 `--max-concurrency=4`），上游根因的第二前提不成立；fork 的 12 个 jsdom 测试文件各自直接 `import { JSDOM } from "jsdom"`，不经 preload；bunfig.toml 另有 `smol = true` 内存优化。[INFERENCE] fork 默认并发（runner 4 CPU）下多个 jsdom 文件并行仍存在同类 epoll 碰撞的残余理论风险，但无 preload 放大、无该签名故障报告，且 fork 已知的 cli.test.ts 2 个 pre-existing 失败为任务侧断言问题、与 epoll 无关。

**适合迁移的内容**：无可直接复用的代码（fork 没有 preload 文件与两遍式脚本的挂载点）；可借鉴的思路：若 fork 未来 ubuntu CI 出现同签名 flake，按"DOM 文件单进程 pass + artifact glob `test-results*.xml`"分区方案处置；`b79fa3a` 的 /proc fdinfo 探针方法可复用作诊断手段。

**需要排除/调整的内容**：不移植 `scripts/run-ci-tests.ts` 两遍式脚本（fork 无 preload 根因，引入会与 fork ci.yml 的直跑拓扑冲突）；不引入 `test-preload.ts` env 门控；fork ci.yml 的 Windows `--max-concurrency=4` 与 Ubuntu 超时参数保持现状。排除清单核对：不涉及（纯 CI 基础设施）。

**迁移优先级**：**C** - fork 缺少上游根因的两个前提（全局 jsdom preload + `--parallel=2`），机制上不受困；无同签名故障记录；引入两遍式脚本是纯成本。仅作应急预案知识保留。

**迁移建议**：③忽略（记录根因与两遍式处置方案为 CI 应急预案；若未来 fork ubuntu 出现同签名整文件中止，再按 b79fa3a 探针确认 + 分区方案处理）。

---

# 六、跳过项（C 类）

## C1：BACK-579 多行 flag 文档（不导入 draft）

**理由**：fork 已在 CLI/skill 实现 processCliEscapes 与多行规范，无迁移价值。

## C2：BACK-578 Rosetta stderr 泄漏（不导入 draft）

**理由**：macOS 专属，fork 无 rosetta 代码（Windows 开发环境）。

## C3：BACK-619 README 示例修复（不导入 draft）

**理由**：纯文档，fork README 结构独立。

## C4：BACK-573 浏览器初始化错误清 loading（不导入 draft）

**理由**：fork 已有 browser-loading-state.ts（BACK-566 定制），机制已覆盖。

## C5：BACK-611 删死 TUI 文件（不导入 draft）

**理由**：fork 视图结构已自行裁剪（enhanced-views/simple-unified-view/unified-view 为 fork 自研）。

## C6：BACK-599/600 身份对齐（不导入 draft）

**理由**：代码已并入 593/580 PR，范围内仅跟踪 commit。

## C7：BACK-594/595/596/601/625-632 跟踪任务（不导入 draft）

**理由**：无代码，纯 backlog 跟踪（MCP 现代化、Agent Plugin 打包、readiness deferral、follow-up）。
