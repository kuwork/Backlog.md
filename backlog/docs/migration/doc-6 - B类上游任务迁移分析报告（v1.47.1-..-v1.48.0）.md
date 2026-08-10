---
id: doc-6
title: B类上游任务迁移分析报告（v1.47.1 .. v1.48.0）
type: guide
created_date: '2026-08-04 06:55'
updated_date: '2026-08-09'
---
# B类上游任务迁移分析报告（v1.47.1 .. v1.48.0）

本报告对应 `doc-4` 中 **B类（评估合入）** 条目，逐项分析上游任务核心目的、变更内容、与当前 fork 的交集风险、适合迁移的部分、需要调整/排除的部分、迁移优先级与建议。所有原始任务文件已作为 draft 导入到 `backlog/drafts/`，通过 `DRAFT#N` 链接可查看。

> 分析前提：当前 fork 已演进的能力以 `references/current-branch-migration-exclusions.md` 为准；分析同时以当前工作分支 `task-529` 的代码状态为基线（`BACK-529` 已完成）。

---

## 分析方法说明

每项按以下维度给出结论：

| 维度 | 说明 |
|------|------|
| 当前 fork 状态 | 该功能在当前分支是否已经实现、部分实现或未实现 |
| 与当前定制的冲突 | 与当前 fork 已有能力（自定义前缀、跨分支任务、本地时区日期、统计页面等）的潜在冲突 |
| 迁移价值 | 对用户/代理工作流的价值 |
| 迁移建议 | 直接复用 / 参考重写 / 跳过 / 需要用户确认 |
| 风险等级 | 高 / 中 / 低 |

---

## B1：BACK-257 任务深度链接

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 为看板和任务列表添加可分享的 deep link：`/board/123/title` 和 `/tasks/123/title`，点击后自动弹出任务弹窗；关闭弹窗恢复 URL；保留 legacy `?highlight=task-123` 兼容。 |
| **当前 fork 状态** | 当前 fork 已实现独立的 `/task/:id/:title` 和 `/draft/:id/:title` 路由（`src/web/App.tsx`），点击任务会导航到该 URL 并打开弹窗，浏览器 Back/Close 会恢复 URL。功能已被覆盖，但路径设计与上游不同：当前 fork 统一使用 `/task/` 而不是 `/board/` 或 `/tasks/`。 |
| **与当前定制的冲突** | 中。若改为上游的 `/board/*` 和 `/tasks/*` 路径，会与当前 `/board` 作为独立页面（以及 `/tasks` 作为 All Tasks 页面）冲突；需要为 board/list 视图增加通配路由，改动较大。当前 `/task/:id` 统一路径已与甘特图/统计页面中的任务链接兼容。 |
| **适合迁移的内容** | 如果当前弹窗尚未支持 legacy `?highlight=task-123` 参数回退，可以补充该兼容逻辑。 |
| **需要排除/调整的内容** | 不建议迁移 `/board/:id/:title` 和 `/tasks/:id/:title` 路由形态，当前 fork 的 `/task/:id/:title` 设计更统一。 |
| **迁移建议** | **跳过（用户决策 2026-08-09）**。当前 fork 已用统一的 `/task/:id/:title` 和 `/draft/:id/:title` 路由（`src/web/App.tsx`）实现类似能力：点击任务导航到 URL 并打开弹窗，Back/Close 恢复 URL。上游 `/board/*`、`/tasks/*` 路径会与当前 fork 独立页面路由冲突，不迁移。 |
| **风险等级** | 中（路由冲突）——已决定跳过，无实施风险 |

---

## B2：BACK-530 用户自定义优先级值

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 允许项目通过配置定义自己的优先级列表（如 Very High / High / Medium / Low / Very Low），不再限定为 high/medium/low；CLI、MCP、Web、统计均支持。 |
| **当前 fork 状态** | 当前 fork 的优先级仍是硬编码 `high` | `medium` | `low`：`Task.priority`、`TaskCreateInput.priority`、`TaskUpdateInput.priority`、`SearchPriorityFilter`、`TaskListFilter.priority` 等类型全部固定。CLI 帮助文案、task wizard、server API 过滤器、统计页面均按三档优先级处理。i18n 层按内建三档翻译（`t.common.high/medium/low`、`t.taskDetails.priorityLabel`、`t.taskCard.priorityShort`）。 |
| **与当前定制的冲突** | 高。① 自定义优先级值是项目数据，无法翻译，需界定"内建默认值翻译、用户配置值透传"的两档 i18n 边界，且现有 `?? level` 兜底会把未知值显示为小写原文；② 统计页面与看板按 high/medium/low 做柱状分布、取色、图标，需全部改为按配置列表动态化；③ CLI 帮助文案、task wizard prompt、搜索/过滤（`PRIORITY_OPTIONS`、`isSearchPriority`）、MCP/server API 过滤器需从固定三档改为读取配置。 |
| **适合迁移的内容** | 全部适合：配置 `priorities`、core 验证、CLI/MCP 帮助文案与枚举、Web 过滤/排序/编辑、统计页面动态分布。 |
| **需要排除/调整的内容** | 保持默认回退为 `[high, medium, low]`，确保现有项目无配置时不改变行为；放开 `Task.priority` 等字面量联合类型为 `string`（失去编译期校验，需运行时兜底顶上来）；颜色/图标/排序 rank（`getPriorityColor`、`PriorityIcon`、`getPriorityBadge`、`BUCKET_PRIORITY_RANK` 等）从按名字硬编码改为按配置索引动态化；Web 统计页面重构固定三档分布逻辑；过滤/校验层（`PRIORITY_OPTIONS`、`isSearchPriority`、CLI/MCP/server filter）改为动态集合，否则自定义值"存得进、筛不出"。 |
| **迁移建议** | **不建议迁移**。总体风险大于收益：改动面横跨 core 校验、CLI、MCP、server 过滤、Web 编辑/过滤/排序/统计、i18n 翻译边界与类型系统，需同步放开类型并动态化颜色/排序/过滤三套逻辑，任何一处遗漏都会导致自定义优先级"存得进、筛不出"或显示/排序退化（不报错但静默失效）。收益仅为优先级标签可配置，当前 fork 三档已满足绝大多数场景。若未来确需，建议以 `back-259` 承接并单独立项，而非作为 v1.48.0 迁移的一部分。 |
| **风险等级** | 高（类型放开 + 颜色/排序/过滤动态化 + 统计重构 + i18n 边界，改动面广且易遗漏） |

---

## B3：BACK-532 `--exclude-status` 过滤

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 CLI 任务列表/搜索、Web All Tasks 中支持排除一个或多个状态，可与其他过滤器组合；同步扩展 `--status` 支持多选。 |
| **当前 fork 状态** | 当前 fork 不支持 `excludeStatus` 过滤。`TaskListFilter` 和 `SearchFilters` 只有 `status`（正向筛选，`TaskListFilter.status` 为单值、`SearchFilters.status` 已支持数组），CLI 也没有 `--exclude-status` 选项。Web 已有 Label 多选筛选器（`LabelFilterDropdown`）可参考；MCP `taskListSchema`/`taskSearchSchema` 的 `status` 为单值 string。 |
| **与当前定制的冲突** | 低。是新增过滤维度，与现有过滤器正交。注意 Web 状态多选与既有任务 back-424（Web 多状态过滤，To Do）范围重叠。 |
| **适合迁移的内容** | 全部适合：core `applyTaskFilters` 增加 `excludeStatus`、CLI `--exclude-status`、CLI `--status` 多选、Web All Tasks 参考 Label 筛选器实现状态多选与排除（URL query 持久化）、TUI 统一视图过滤状态集成。**MCP 需实现**（用户决策：与上游移除 MCP 表面的方向相反，当前 fork 要求 MCP task list/search 支持状态多选与排除，schema 风格同既有 `labels` 数组）。 |
| **需要排除/调整的内容** | 无显著排除点。注意与 TUI 统一视图过滤状态的集成；与 back-424 的范围重叠需在实施时协调。 |
| **迁移建议** | **建议迁移**。工作量小，价值高，与现有过滤框架自然兼容。已升级为 [BACK-548](/task/548)。 |
| **风险等级** | 低 |

---

## B4：BACK-531 看板创建日期排序

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在看板列菜单中增加按任务创建日期排序的选项（最旧优先 / 最新优先）。 |
| **当前 fork 状态** | 当前 `TaskColumn` 列菜单仅支持 `id`、`title`、`priority` 排序，没有 `createdDate` 排序选项。 |
| **与当前定制的冲突** | 低。使用现有 `task.createdDate` 字段，无需 schema 变更。 |
| **适合迁移的内容** | 在 `TaskColumn` 本地排序和 `sortOptions` 中增加 `createdDate` 升序/降序。 |
| **需要排除/调整的内容** | 当前 fork 的菜单结构已与上游不同（已有 `ID/Title/Priority` 本地排序），所以按当前 fork 的本地排序模式实现 `createdDate`，而不是上游的持久化 reorder 模式。 |
| **迁移建议** | **已迁移为 [BACK-541](/task/541)**。实现为本地排序，复用现有 `sortOptions` 和 `t.taskList.columns.created` 标签；缺失/无效日期排最后，任务 ID 作为决胜。 |
| **风险等级** | 低 |

---

## B5：BACK-527 任务列表 ordinal 排序（已迁移为 BACK-542）

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 Web All Tasks 列表和 CLI `task list` 中让任务能够按 ordinal（排序号）排序，与看板视图保持一致。 |
| **当前 fork 状态** | 当前 `TaskList` 的 `TaskSortColumn` 包含 `id`、`title`、`status`、`priority`、`milestone`、`created`，不包含 `ordinal`；默认按 ID 降序。CLI `task list` 默认按 `priority` 排序，`--sort` 帮助与验证数组仅支持 `priority`/`id`，但 `src/utils/task-sorting.ts` 的 `sortTasks()` 和 `sortByOrdinal()` 已经实现。 |
| **与当前定制的冲突** | 低。当前 fork 表头排序交互是“同列切换升/降序”，需要增加第三下取消排序并回到默认 ordinal。 |
| **适合迁移的内容** | 将默认排序改为 ordinal；表头排序第三次点击取消当前列排序并恢复 ordinal 默认；CLI 默认 `task list` 输出 ordinal 排序，并继续支持 `--sort ordinal`。 |
| **需要排除/调整的内容** | **不新增独立的 Ordinal 列**。页面不能直接修改 ordinal，增加列会造成冗余信息；通过默认排序和“取消排序”交互表达 ordinal 顺序。 |
| **迁移建议** | **已迁移为 [BACK-542](/task/542)**。实现为：默认按 ordinal 排序，表头第三次点击取消排序，CLI 默认返回 ordinal。 |
| **风险等级** | 低 |

---

## B6：BACK-427 未分配任务过滤

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 CLI 和 MCP 的任务列表/搜索中支持过滤未分配任务（assignee 为空）。 |
| **当前 fork 状态** | 当前 `TaskListFilter` 只有 `assignee`（正向匹配），没有 `unassigned` 布尔过滤。CLI 和 MCP 均不支持。Web 里程碑页面有“Unassigned”分组，但那是 milestone 视图，不是通用过滤。 |
| **与当前定制的冲突** | 低。新增过滤器，与 `--assignee` 互斥即可。 |
| **适合迁移的内容** | `TaskListFilter.unassigned`、core `applyTaskFilters` 共享实现、CLI `--unassigned`、MCP `task_list` schema 字段。 |
| **需要排除/调整的内容** | 无。 |
| **迁移建议** | **已迁移为 [BACK-551](/task/551)**。`TaskListFilter.unassigned` 由 core `applyTaskFilters` 单点实现，CLI 新增 `--unassigned` 并与 `--assignee` 互斥，MCP `task_list` 新增 `unassigned` 布尔字段并在 Draft 路径同样生效。 |
| **风险等级** | 低 |

---

## B7：BACK-523 `doc view --plain`

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 为 `backlog doc view` 增加 `--plain` 标志，以纯文本形式输出文档内容，便于脚本使用；非 TTY 自动 plain。 |
| **当前 fork 状态** | 当前 `doc view` 没有 `--plain` 选项，只有 `doc list --plain`（`src/cli.ts` 第 3802 行）。 |
| **与当前定制的冲突** | 低。与现有 `--plain` 模式一致。 |
| **适合迁移的内容** | 全部适合：CLI 命令增加 `--plain`、非 TTY 自动 plain、帮助文案与测试。 |
| **需要排除/调整的内容** | 无。 |
| **迁移建议** | **已迁移为 [BACK-552](/task/552)**。小功能，与 `task view --plain` 等保持一致的 CLI 表面。 |
| **风险等级** | 低 |

---

## B8：BACK-466 隐藏空状态列（已找回 DRAFT-81）

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 当配置开启时（`hideEmptyColumns: true`），看板中不显示没有任何任务的状态列；拖拽时临时显示空列以保留放置目标。 |
| **上游变更范围** | 9 个文件：`src/types/index.ts`（新增 `hideEmptyColumns?: boolean`）、`src/file-system/operations.ts`（YAML 读写）、`src/cli.ts`（`config get/set/list`）、`src/test/config-commands.test.ts`（回归测试）、`src/web/App.tsx` / `BoardPage.tsx` / `Board.tsx` / `Settings.tsx`（UI 与状态过滤）。 |
| **当前 fork 状态** | 当前 fork 没有 `hideEmptyColumns` 配置字段，也没有相关 UI 逻辑。`BacklogConfig` 类型中没有该字段。当前 `Board.tsx` 已存在类似的 `visibleLanes` 空泳道过滤逻辑（第 396 行），说明当前 fork 的 board 渲染结构与上游兼容。 |
| **与当前定制的冲突** | 低。新增 opt-in 配置项，默认 `false`，不影响现有行为。当前 fork 的 `Board.tsx` 渲染直接遍历 `statuses`（第 594、595、634 行），只需替换为 `visibleStatuses` 即可。 |
| **适合迁移的内容** | 全部适合：配置类型、`config.yml` 解析/保存、CLI `config get/set/list`、Settings UI 开关、`Board.tsx` 空列过滤逻辑（拖拽时临时显示）、回归测试。 |
| **需要排除/调整的内容** | 无。Settings UI 文案需要本地化（当前 fork 支持 i18n，上游 PR 使用英文硬编码，需补充 `src/web/locales/*.ts` 条目）。 |
| **迁移建议** | **建议迁移**。工作量小，与当前 fork 看板结构天然兼容，是低风险的配置项增强。实施时以 [DRAFT#81](/draft/81) / commit `17ca0bf` / PR #660 为准。 |
| **风险等级** | 低 |
| **draft 链接说明** | 已从上游找回该任务并生成 [DRAFT#81](/draft/81)。注意：上游 `BACK-466` 编号被两个 PR 共用——#660 是隐藏空状态列，#664 是 win32-arm64 预编译二进制；`doc-4` 原链接的 [DRAFT#36](/draft/36) 实际对应 #664，而非 B8。 |

---

## B9：BACK-421 `dateFormat` 配置统一生效

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 使 `dateFormat` 配置在 TUI、Web UI、CLI 展示中统一生效；仅影响显示，不改变 UTC 存储格式。 |
| **当前 fork 状态** | `BacklogConfig.dateFormat` 字段已存在，但当前 `src/web/utils/date-display.ts` 和 `src/utils/date-utc.ts` 仅使用 `toLocaleDateString()` / `toLocaleString()`，没有根据 `dateFormat` 重新排列。`dateFormat` 配置实际未生效。 |
| **与当前定制的冲突** | 中。当前 fork 的日期显示策略是“本地时区展示”，而上游实现是按 `dateFormat` 重新排列 canonical UTC 字符串（如 `dd/mm/yyyy`）。两者叠加时可能产生混乱：例如 `dateFormat: dd/mm/yyyy` 与本地时区显示结合，可能导致双重转换。需要明确是否只影响日期部分，时间部分是否仍用本地时区。 |
| **适合迁移的内容** | 共享日期格式化函数增加 `dateFormat` 支持；Web/TUI/CLI 展示层统一使用。 |
| **需要排除/调整的内容** | **不照搬**上游仅按 dateFormat 格式化而不显示本地时区的做法；当前 fork 已选择本地时区显示（如 `BACK-378`）。上游 B9 建立在 C10（BACK-471 UTC 显示）之上：B9 的 `dateFormat` 是对 canonical UTC 字符串的 token 重排（`src/utils/utc-date-display.ts`），在当前 fork 中该文件不存在，直接照搬会显示 UTC 日期、破坏本地时区契约。且 `actualStart`/`actualEnd` 的 Web 编辑输入框是原生 `datetime-local`（HTML 规范强制 value 为 ISO `YYYY-MM-DDTHH:mm`），dateFormat 无法作用于编辑框，若仅改只读显示会造成"显示/编辑格式不一致"。 |
| **迁移建议** | **跳过（用户决策 2026-08-09）**。上游 B9 与当前 fork 本地时区显示策略存在根本语义冲突，且受原生 `datetime-local` 控件约束无法完整生效；缩小到仅 Web 创建/更新时间也只带来显示/语义割裂，收益低，不做迁移。`dateFormat` 保持"配置存在但不生效"现状（与 C10 冲突边缘，一并跳过）。 |
| **风险等级** | 中（日期显示策略决策）——已决定跳过，无实施风险 |

---

## B10：BACK-525 Browser UI 构建现代化

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 将浏览器 UI 构建路径迁移到 Bun-native 全栈构建：`bun-plugin-tailwind` + `Bun.build`，编译后的二进制直接嵌入 React 应用和静态资源；移除已生成的 `style.css` 和 favicon 回退。 |
| **当前 fork 状态** | 当前 fork 使用 `@tailwindcss/cli` 预生成 `src/web/styles/style.css`（`build:css` 脚本），然后 `bun build --compile` 打包。`package.json` 已包含 `@kuwork/backlog.md-windows-arm64` 等 6 个平台包。不是上游的 `bun-plugin-tailwind` 路径。 |
| **与当前定制的冲突** | 高。构建路径改动大，会影响 CI、release、Nix、本地开发、预提交、asset 嵌入方式。当前 fork 的 `style.css` 也是预提交/构建的一部分，切换后需确保所有工作流稳定。 |
| **适合迁移的内容** | `scripts/build.ts`（Bun.build + bun-plugin-tailwind）、`src/web/index.html` 指向 `source.css`、移除 server 的 favicon 回退、`src/test/build.test.ts` 扩展、CI/release/Nix/开发文档同步。 |
| **需要排除/调整的内容** | 当前 fork 的 `style.css` 是预提交/构建的一部分，切换后需确保 CI、release、Nix、本地开发、预提交所有工作流稳定；`resolveBinary.cjs`/`cli.cjs` 等打包脚本需与共享 build.ts 保持一致。 |
| **迁移建议** | **已迁移为 [BACK-553](/task/553)**。风险较高（构建路径大改），但改动边界清晰、收益明确，单独立项推进。 |
| **风险等级** | 高（构建系统改动，需谨慎验证） |

---

## B11：BACK-529 浏览器标签过滤字母排序

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | Web UI 中标签过滤器按字母顺序排序。 |
| **当前 fork 状态** | 当前 `collectAvailableLabels`（`src/utils/label-filter.ts`）按首次出现顺序返回标签，未排序。 |
| **与当前定制的冲突** | 低。 |
| **适合迁移的内容** | 在 `collectAvailableLabels` 中按 case-insensitive、locale-independent 方式排序。 |
| **需要排除/调整的内容** | 无。 |
| **迁移建议** | **建议迁移**。小优化，上游已实现确定性排序（含 Unicode NFC/NFD 处理）。 |
| **风险等级** | 低 |

---

## B12：BACK-526 里程碑任务列表增加 Created 列（已迁移为 BACK-543）

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 让 Web 里程碑页面每个 milestone 卡片内部的任务列表拥有与 All Tasks 列表（BACK-542）一致的排序交互：默认按 ordinal（排序号）排序、增加 `Created` 列、表头三击循环（升序 → 降序 → 取消并恢复默认 ordinal）。**不改动里程碑卡片本身的排序。** |
| **当前 fork 状态** | 当前 `MilestonesPage` 的 bucket 任务表格只有 ID/Title/Status/Priority 四列，没有 `Created` 列；`BucketSortColumn` 也不包含 `created`；无默认 ordinal 排序逻辑，也无三击清除循环。 |
| **与当前定制的冲突** | 低。与 All Tasks 列表已支持的 `created` 排序、默认 ordinal 排序及三击循环复用同一工具函数与交互模式，无 schema 变更。 |
| **适合迁移的内容** | 在 bucket 表头增加 `Created` 列按钮；`BucketSortColumn` 增加 `created`；`getSortedTasks` 在无配置时默认返回 `sortByOrdinal(bucketTasks)`，并增加按 `createdDate` 排序分支；`handleBucketSortChange` 改为三击循环（asc → desc → 清除并恢复默认 ordinal）；`MilestoneTaskRow` 显示创建日期并调整为 6 列 grid；补充 i18n 与测试。 |
| **需要排除/调整的内容** | **不改动里程碑卡片本身的排序**（仍保持按 milestone ID 降序，最新在前）。用户 clarified 只需任务列表加列并与 All Tasks 交互一致。 |
| **迁移建议** | **已迁移为 [BACK-543](/task/543)**。实现为：每个里程碑卡片的任务表格默认按 ordinal 排序，新增 `Created` 列，表头三击循环（asc → desc → cleared/ordinal），缺失/无效日期排最后并以任务 ID 决胜。 |
| **风险等级** | 低 |

---

## B13：BACK-517 浏览器任务详情显示 AC 序号

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 Web UI 任务详情中显示验收标准的编号。 |
| **当前 fork 状态** | 当前 `TaskDetailsModal` 的 `acceptanceCriteriaItems` 渲染未显示 `c.index`，仅显示复选框和文本。 |
| **与当前定制的冲突** | 低。不影响存储、解析、schema、board/list 卡片。 |
| **适合迁移的内容** | 在 `TaskDetailsModal` 的 AC 预览渲染中显示 `c.index`。 |
| **需要排除/调整的内容** | 不改变 `AcceptanceCriteriaEditor` 或持久化格式。 |
| **迁移建议** | **已迁移为 [BACK-544](/task/544)**。小优化，工作量极低。 |
| **风险等级** | 低 |

---

## 总结与建议

| 建议 | 条目 | 理由 |
|------|------|------|
| **建议迁移** | B2、B3、B4、B5、B6、B7、B8、B10、B11、B12、B13 | 价值明确，与当前 fork 定制冲突低/边界清晰，工作量可控。 |
| **建议跳过** | B1 | 当前 fork 已用统一的 `/task/:id/:title` 路由实现类似能力，上游 `/board/*`、`/tasks/*` 路径与当前 fork 独立页面路由冲突。**用户已决策跳过（2026-08-09）**。 |
| **建议跳过** | B9 | 上游 B9 建立在 C10（UTC 显示）之上，照搬会破坏当前 fork 本地时区显示契约；原生 `datetime-local` 编辑框无法应用 dateFormat，仅改只读显示造成显示/编辑割裂，收益低。**用户已决策跳过（2026-08-09）**。 |

### 优先级排序（从价值/风险比）

1. **B7、B13、B4、B11、B12** —— 最小改动，立即收益。
2. **B3、B6、B5** —— 过滤/排序增强，涉及 CLI + Web + 核心共享逻辑，但边界清晰。
3. **B8** —— 小功能，但需注意 `doc-4` 中 draft 链接错误，实施时参考上游 commit `17ca0bf` / PR #660。
4. **B10** —— 已迁移为 [BACK-553](/task/553)，构建路径大改需谨慎，独立推进。
5. **B2** —— 中等工作量，收益高，需要同步更新统计页面和 task wizard。
6. **B1、B9** —— 已决策跳过（B1：fork 已实现类似路由；B9：与本地时区策略冲突且受 datetime-local 约束）。

### 需要修正的记录

- `doc-4` 中 **B8** 的 `[DRAFT#36](/draft/36)` 链接错误：draft-36 对应的是 win32-arm64 预编译二进制，不是隐藏空状态列。建议将 B8 的 draft 链接改为无链接（该功能无对应 draft），或补充说明参考上游 commit `17ca0bf` / PR #660。

如需将上述建议中的条目升级为当前 fork 的正式迁移任务，可以按子组创建任务（如 `BACK-XXX` 用户自定义优先级迁移、`BACK-XXX` 排除状态过滤迁移等）。
