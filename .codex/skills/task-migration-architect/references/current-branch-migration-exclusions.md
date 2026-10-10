# 当前分支迁移排除清单

本文件记录当前工作分支已演进的定制能力。从上游分支迁移任务时，**不应将这些能力回退为旧实现**，也不应在上游任务描述/实施计划中恢复已被替代的旧模式。

---

## 1. 里程碑时间字段增强

当前分支已为里程碑引入 `actualStart` / `actualEnd` 字段，并由下属任务状态自动填充。

**不应回退的内容：**
- 将 `Milestone` 类型中的 `actualStart` / `actualEnd` 移除或改为不支持
- 将 CLI 的 `milestone edit` 降级回仅支持重命名的 `milestone rename`
- 移除 `milestone create` CLI 命令
- 恢复旧的 milestone handler/schema，不包含 actual 日期字段
- 在 Web UI 里程碑表单中移除 `datetime-local` 输入

**替代方向：**
- 保持 `updateMilestone` 命名与实现
- 保持 actual 字段的自动填充逻辑（任一任务进入进行中时填充 actualStart，最后一个非终态任务结束时填充 actualEnd）

---

## 2. 任务日期字段体系

当前分支建立了完整的日期字段语义：`dueDate` / `plannedStart` / `plannedEnd`（date-only）与 `actualStart` / `actualEnd`（UTC date-time）。

**核心策略**：日期时间以 UTC 格式存储在 Markdown 文件中；在 TUI、Web UI、CLI `--plain` 输出等展示层使用本地时区渲染（通过 `toLocaleString` / `toLocaleDateString`）。CLI/MCP 输入通过 `localDateTimeToStoredUtc` 将本地时间转换为 UTC 后再存储。

**不应回退的内容：**
- 移除 `Task`、`TaskCreateInput`、`TaskUpdateInput`、`Milestone` 中的日期字段
- 恢复用 `undefined` 清除日期字段的旧逻辑；当前分支使用 **空字符串 `""`** 作为清除信号
- 恢复 CLI/MCP 直接写入本地时间的旧行为；当前分支通过 `localDateTimeToStoredUtc` 统一转换为 UTC
- 移除 Markdown parse/serialize 中对 `due_date` / `planned_start` / `planned_end` 的支持
- 移除 TaskCard/任务详情中的日期指示器与自动填充
- **将展示层改为 UTC 显示**；当前分支采用「存储 UTC、展示本地时区」策略，上游若要求统一 UTC 显示则与当前策略冲突

**替代方向：**
- 日期清空时发送 `""`，由 core 层 `applyOptionalDateField` 转为 `undefined` 并删除字段
- CLI/MCP 输入经过 `localDateTimeToStoredUtc` 处理后再存储
- Web UI 复用共享的 UTC 转换工具

---

## 3. 甘特图视图

当前分支已实现基础甘特图与跟踪甘特图，属于独立演进的时间维度可视化能力。

**不应回退的内容：**
- 移除 `/gantt` 路由或 `GanttView` 组件
- 移除甘特图依赖的日期解析优先级（`plannedStart` → `createdDate`）
- 移除双层甘特条（计划 vs 实际）渲染
- 恢复为早期无甘特图的页面结构

**替代方向：**
- 甘特图相关改动应作为增量优化保留
- 上游任务若涉及时间展示，应适配甘特图已有的时间解析规则，而非覆盖

---

## 4. 统计页面（Overview）

当前分支已实现项目级统计页面，包含贡献热力图、状态概览、优先级分布、项目健康度、最近活动，并支持 WebSocket 实时刷新。

**不应回退的内容：**
- 移除 `/overview` 或 `/statistics` 路由与对应组件
- 移除服务端统计缓存与 `"statistics-updated"` WebSocket 推送
- 移除项目健康度分类（临期、逾期、停滞、阻塞）
- 恢复为早期无统计页面或仅有简单计数的页面

**替代方向：**
- 统计相关改动应作为增强保留
- 上游任务若新增指标，应接入现有统计缓存与推送机制

---

## 5. 任务编辑引用/文档/依赖的 set/add/remove/clear 语义

当前分支已通过 `BACK-578` 将 `task edit` 的 `--ref` / `--doc` / `--depends-on` / `--dep` 定为**替换整个列表**（set 语义），并新增 `--add-ref` / `--add-doc` / `--add-depends-on` / `--add-dep` 用于**追加到现有列表**；`--remove-ref` / `--remove-doc` / `--remove-dep` 用于按值移除单个条目；`--clear-refs` / `--clear-docs` / `--clear-deps` 仍然是显式清空整个列表的唯一方式。set 标志与 add 标志在同一命令中互斥。

**不应回退的内容：**
- 将 `task edit --ref` / `--doc` / `--depends-on` / `--dep` 改为追加语义，或恢复旧的不区分 set/add 的混合行为
- 移除 `--add-ref` / `--add-doc` / `--add-depends-on` / `--add-dep` 选项或其对应的模型操作
- 移除 `--remove-ref` / `--remove-doc` / `--remove-dep` 选项或其对应的模型操作
- 允许 `--ref` 与 `--add-ref`、 `--doc` 与 `--add-doc`、 `--depends-on`/`--dep` 与 `--add-depends-on`/`--add-dep` 同时出现在同一条命令中
- 在帮助文本、CLI schema、MCP schema 或 agent 指南中继续将 `--ref` / `--doc` / `--depends-on` / `--dep` 描述为「追加列表」
- 移除 `TaskEditArgs` 中的 `addDependencies` / `removeDependencies` 字段，或 `buildTaskUpdateInput` 中对 set/add/remove 的共享处理

**替代方向：**
- 保持 `--ref` / `--doc` / `--depends-on` / `--dep` 的 set 语义，与 `--add-*` / `--remove-*` / `--clear-*` 共同构成完整的增量编辑模型
- 新增引用/文档/依赖相关 CLI/MCP 行为时，优先复用 `references` / `documentation` / `dependencies` 做 set，复用 `addReferences` / `addDocumentation` / `addDependencies` 做追加，以及对应的 `remove*` 模型操作
- 在迁移涉及这些标志的上游任务时，先检查上游默认语义：若上游使用替换语义，则保持当前分支的 set 语义；若上游使用追加语义，则映射到当前分支的 `--add-*` 标志

---

## 6. sequences 功能（上游已移除，fork 保留并持续演进）

当前分支保留 sequences 能力：从任务依赖计算可并行任务组，`backlog sequence list` 有 CLI 与 TUI 双面板视图，且已补齐指令文档（上游已移除该功能）。

**不应回退的内容：**
- 移除依赖序列计算、`backlog sequence list` 命令或 TUI 序列视图
- 接受上游删除/精简序列相关代码的改动

**替代方向：**
- 迁移涉及任务依赖、排序、序列的改动时保持 sequences 能力不动
- 上游对序列功能的删除类 commit 一律按 C 类跳过，并在理由中引用本条目

---

## 7. 状态机语义化（statuses 对象形式）

当前分支的 `statuses` 配置是带语义的**状态机**：每个状态含 `category`（initial/active/wip/blocked/done/dropped）、`exit`、`display`、`next[]` 迁移边（可挂 `when`/`ai`/`if`/`requires`/`evidence`）。终态由 category 派生（`config list` 打印 `terminalStatuses` 派生行），不是"数组末位"约定；设置页状态机编辑器是终态的唯一写入口；机器指引经 `{{STATE_MACHINE}}` 占位符注入 AGENTS.md/CLAUDE.md；默认七列机器有 en/zh-CN/zh-TW/ja 四语言变体。

**不应回退的内容：**
- 把 statuses 当纯字符串列解析，或移除 category/exit/next 语义恢复"末位即终态、inprogress 硬编码"旧约定
- 移除设置页状态机编辑器，或在设置页恢复"终态多选"这类第二写入口
- 移除机器指引注入（AGENTS.md/CLAUDE.md 的 state-machine 块）

**替代方向：**
- 迁移涉及状态/配置/看板列/完成判定的改动时，一律按对象形式 statuses 适配
- 终态判定统一走 `getTerminalStatuses` 派生，不猜名字或列位置

---

## 8. memos 快速笔记子系统

当前分支存在第五种文件实体：memos。`backlog/memos/` 下有独立存储层（`src/core/memos.ts`）、CLI `backlog memo` 命令组、MCP memo 五工具、`/api/memos` 路由、`/memos` 页面（信息流/日历/钉板三模式）、归档到 `backlog/archive/memos/`。init 目录清单与图谱扫描白名单均已包含 memos。

**不应回退的内容：**
- 移除 memo 命令组、路由、页面或 MCP 工具
- 恢复"目录只有 tasks/docs/decisions/milestones"的假设（init 目录清单、ensureBacklogStructure、graph scanner、watcher 均需含 memos）
- memo/graph 等面的目录解析绕过 `resolveBacklogDirectory()`（自定义 backlog-dir 项目会读写落错路径）

**替代方向：**
- 迁移涉及目录结构、实体类型、导航、文件监视的改动时，把 memos 当一等实体对待
- 新增产物面时目录解析统一走 `resolveBacklogDirectory()`

---

## 9. Kuzu 任务/知识图谱

当前分支有 `src/graph` 图谱模块：GraphService（指纹冷启动 + 增量热更新 + 锁接管）、`/graph` 任务图谱与 `/knowledge` 知识图谱双视图、FileNode(path PK) 节点模型、`graph-updated` WebSocket 广播。core 变更层（saveTask、archive/complete、promote/demote 等）有 notify 钩子驱动图谱热更新。

**不应回退的内容：**
- 移除图谱路由、服务、视图或前端 graphVersion 刷新管线
- 在 core 变更 notify 管线中漏掉给图谱的变更通知点（新增实体类型/生命周期操作时必须补钩子）
- 把图数据库存进项目内 backlog 目录（当前在全局缓存目录，按 slot 键控）

**替代方向：**
- 迁移涉及文件实体、依赖关系、前端路由的改动时，检查是否需要给图谱 notify 钩子补新实体类型或新边

---

## 10. 任务评论

当前分支有结构化任务评论：sentinel 定界的 `## Comments` 章节持久化于任务 Markdown，CLI/MCP/Web/TUI 四表面统一视图，评论文本进入搜索索引，支持删除（`--remove-comment`/`--clear-comments`）。

**不应回退的内容：**
- 移除 Comments 章节解析/序列化/渲染，或把评论降级为自由正文
- 在任务文件结构（结构化章节提取、tokenizer 清单解析）改动时破坏 sentinel 章节约定

**替代方向：**
- 迁移涉及任务文件结构、Markdown 序列化、搜索索引的改动时保持评论章节约定

---

## 11. 跨分支任务体系

当前分支有完整的跨分支任务感知：TaskIdentityIndex（canonical ID + 逻辑路径统一身份，歧义 fail-closed 409）、增量跨分支加载（不可变 tip 快照、有界 fetch、ref 租约、请求合并）、`checkActiveBranches`（扫描轴）与 `includeCrossBranch`（展示轴）两个独立配置、completed 语料选项、跨分支/完成记录的只读门控。

**不应回退的内容：**
- 恢复"ID 即文件名"的单分支身份假设，或移除跨分支/完成记录只读门控
- 把扫描与展示合并成一个开关（两轴分工是刻意设计：扫描还服务 ID 分配候选集）
- 移除增量跨分支加载的快照/租约优化退回每次冷扫描

**替代方向：**
- 迁移涉及任务加载、身份解析、搜索语料、列表过滤的改动时按 identity-index 语义适配

---

## 12. wiki Web UI 体系与 llm-wiki skill

当前分支有浏览器 wiki 体系：`/wiki` 路由文件树浏览与在线编辑、wikilink 渲染（`[[path]]`、别名、属性块、媒体嵌入）、`backlog wiki install` 命令（把 llm-wiki-for-backlog skill 安装到各 agent）、skill 构建时嵌入二进制。

**不应回退的内容：**
- 移除 /wiki 路由、wiki 编辑器或 wikilink 渲染管线
- 把 wiki 目录排除在内容扫描/图谱 ingest 之外（wiki 页面是知识图谱语料的一部分）
- 破坏 wiki install 的符号链接/复制回退机制

**替代方向：**
- 迁移涉及 Markdown 渲染、文件树、路由、内容扫描的改动时保持 wiki 能力

---

## 13. 通用判断原则

当上游任务涉及以下主题时，优先**参考重写**而非**直接复用**：

1. **日期/时间字段处理**：必须对齐当前分支的 date-only vs date-time 语义、空字符串清除、UTC 转换规则，以及**「存储 UTC、展示本地时区」的显示策略**。
2. **里程碑 CLI/MCP/Web API**：必须保持 `updateMilestone` 与 actual 字段支持。
3. **Web UI 路由与导航**：新增路由需与现有 `/gantt`、统计页面共存，不能互相覆盖。
4. **任务状态驱动逻辑**：任何由任务状态变化触发的副作用（如里程碑 actual 字段自动填充）需与现有级联逻辑兼容。
5. **统计与概览数据流**：新增或修改统计相关接口时，应复用 WebSocket 推送与缓存机制。
6. **任务编辑列表字段（refs/docs/deps）**：必须保持 set 语义（`--ref`/`--doc`/`--depends-on`/`--dep` 替换整个列表）、add 语义（`--add-*` 追加）、remove 语义（`--remove-*` 按值移除）和 clear 语义（`--clear-*` 清空）并存；set 与 add 标志互斥。若上游任务仍使用替换语义，保持当前分支 set 语义；若上游任务使用追加语义，映射到当前分支的 `--add-*` 标志。
7. **sequences 功能**：上游已移除、当前分支保留，涉及序列/依赖排序的改动不得回退（见第 6 节）。
8. **状态机语义**：statuses 是带 category/exit/next 边/ai 权限的对象形式状态机，终态按 category 派生；不得恢复字符串列或硬编码终态约定（见第 7 节）。
9. **子系统存在性**：memos、Kuzu 图谱、任务评论、跨分支体系、wiki Web UI 是当前分支的一等能力（第 8~12 节）；迁移改动若移除或绕过这些子系统，直接按 C 类跳过。

---

## 如何应用本清单

在分析上游任务时，针对每个任务检查：

1. 上游是否修改了日期字段相关类型、CLI 选项、MCP schema 或 Web UI 表单？
   - 是 → 对比当前分支实现，排除会移除字段、恢复旧清除/转换逻辑的部分。
2. 上游是否修改了里程碑相关命令、handler 或 UI？
   - 是 → 排除任何降级为 `milestone rename` 或移除 actual 字段支持的部分。
3. 上游是否修改了 Web UI 路由、导航或主布局？
   - 是 → 排除会移除 `/gantt` 或统计页面入口的部分。
4. 上游是否修改了统计/概览相关代码？
   - 是 → 排除会移除缓存、WebSocket 推送或健康度分类的部分。
5. 上游是否修改了 `task edit` 的 `--ref` / `--doc` / `--depends-on` / `--dep` 语义，或相关 `--add-*` / `--remove-*` / `--clear-*` 标志？
   - 是 → 排除任何将 set 语义改为追加、移除 `--add-*` / `--remove-*` 标志、或允许 set/add 标志混用的旧实现。
6. 上游是否涉及任务依赖、并行序列或 `sequence list` 相关代码？
   - 是 → 上游删除/精简序列的改动按 C 类跳过，fork 保留该能力（第 6 节）。
7. 上游是否修改了状态定义、看板列、完成判定或配置中的 `statuses`？
   - 是 → 排除任何把 statuses 降级为字符串列、恢复硬编码终态/inprogress、或移除状态机编辑器的改动（第 7 节）。
8. 上游是否新增/移除文件实体类型、改动目录结构约定（init 清单、归档布局、监视范围）？
   - 是 → 保持 memos 一等实体地位与 `resolveBacklogDirectory()` 统一解析（第 8 节）。
9. 上游是否改动 core 的文件变更通知/生命周期操作（保存、归档、升降级、里程碑写入）？
   - 是 → 检查图谱 notify 钩子是否需要同步补点（第 9 节）。
10. 上游是否改动任务 Markdown 的结构化章节（AC/DoD/Comments/Plan 等）或搜索索引字段？
    - 是 → 保持 sentinel 章节约定与评论索引（第 10 节）。
11. 上游是否改动任务加载、ID 分配、列表过滤或身份解析？
    - 是 → 按 TaskIdentityIndex 与跨分支两轴配置适配，不合并扫描/展示开关（第 11 节）。
12. 上游是否改动 Markdown 渲染、文件树、内容扫描范围？
    - 是 → 保持 wiki 路由/编辑器/wikilink 渲染与 wiki 目录入图（第 12 节）。

凡涉及上述领域，在迁移任务的描述和实施计划中都应采用当前分支的演进方向，不应简单恢复上游旧实现。
