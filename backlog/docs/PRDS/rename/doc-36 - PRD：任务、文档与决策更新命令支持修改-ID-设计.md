---
id: doc-36
title: PRD：任务、文档与决策更新命令支持修改 ID 设计
type: specification
created_date: '2026-11-19 02:52'
updated_date: '2026-11-19 14:49'
---
# PRD：任务、文档与决策更新命令支持修改 ID 设计

## 1. 背景

任务、文档和决策已经通过现有更新命令支持修改标题，并在标题清洗后的文件名发生变化时自动更名：

- `task edit` 更新任务标题。
- `doc update` 更新文档标题。
- `decision update` 更新决策标题。
- 三类操作共享 `FileRenamePlan`，同步处理主文件、精确相对路径引用、结构化路径字段、Wiki 引用和带 slug 的实体路由。

目前缺少的是在同一更新入口中修改实体 ID。若另设 `rename` 子命令，会把标题、ID、其他元数据更新拆成两套入口，重复参数解析、冲突检查和事务逻辑，也不符合现有 CLI 使用习惯。

因此本方案不新增更新类子命令，而是在现有更新命令上增加可选 `--id`，将源对象定位、ID 修改、标题修改、文件更名和引用更新合并到同一次原子操作中。

## 2. 目标

1. 在现有更新命令中支持只修改标题、只修改 ID、同时修改 ID 和标题。
2. 保持现有更新参数与默认行为兼容；未提供 `--id` 时不改变当前语义。
3. 文件名继续由规范 ID 和标题派生，保持 frontmatter、文件名和查询身份一致。
4. 查看与更新命令共用 `--source-path` 源文件选择规则；提供路径时允许省略旧 ID，同时提供时必须校验一致。
5. 新 ID 或目标路径冲突时，在任何写入前失败。
6. 任务改 ID 时保护依赖和父子关系，并同步明确的结构化身份引用。
7. 文档、决策改 ID 或标题时，同步精确路径引用和 `/documentation/:id/:title`、`/decisions/:id/:title` 路由。
8. 多文件写入任一失败时回滚，自动提交包含全部新旧路径和关联文件。

## 3. 非目标

首版不包含：

- 新增 `task rename`、`doc rename` 或 `decision rename` 子命令。
- 任意 `--filename` 或脱离 `<id> - <title>.md` 约定的文件名。
- 为现有更新命令额外引入一套 `dry-run` 工作流；安全性由写入前完整预检和失败回滚保证。
- 对普通 Markdown 文本进行全仓正则替换。
- `draft edit --id`；草稿沿用独立 ID 与生命周期。
- 修改其他分支的远程任务语料。
- 通过 `--id` 进行任务 reparent 或整棵子树级联重编号。
- 任务前缀的整体迁移。

## 4. CLI 设计

### 4.1 查看与更新命令

```bash
backlog task view [taskId] [--source-path <path>]
backlog doc view [docId] [--source-path <path>]
backlog decision view [decisionId] [--source-path <path>]

backlog task edit [taskId] [--id <newId>] [--source-path <path>] [--title <newTitle>] [现有更新参数]
backlog doc update [docId] [--id <newId>] [--source-path <path>] [--title <newTitle>] [现有更新参数]
backlog decision update [decisionId] [--id <newId>] [--source-path <path>] [--title <newTitle>] [现有更新参数]
```

位置参数仍按各命令当前规则识别**旧 ID**，包括文档的 `doc-1` 与裸 `1` 等形式。提供 `--source-path` 时允许省略位置参数，直接由精确文件确定源对象，并从 frontmatter 读取旧 ID。`--id` 始终表示目标 ID，内部使用 `newId` 等独立字段传递，不能覆盖源解析所需的原 ID。

### 4.2 示例

```bash
# 仅传 ID：保持现有查看和更新行为
backlog doc view 1
backlog task edit BACK-1 --title "New task title"
backlog doc update doc-1 --id doc-10
backlog decision update decision-1 --id decision-10 --title "New decision title"

# 仅传 --source-path：省略旧 ID，先准确查看，再修改同一文件
backlog doc view --source-path "backlog/docs/guides/doc-1 - Old-Title.md"
backlog doc update --source-path "backlog/docs/guides/doc-1 - Old-Title.md" --id doc-10

backlog task view --source-path "backlog/tasks/BACK-1 - Old-Title.md"
backlog task edit --source-path "backlog/tasks/BACK-1 - Old-Title.md" --id BACK-10

backlog decision view --source-path "backlog/decisions/decision-1 - Old-Title.md"
backlog decision update --source-path "backlog/decisions/decision-1 - Old-Title.md" --id decision-10

# 同时传 ID 和路径：二者必须匹配
backlog doc update 1 --source-path "backlog/docs/guides/doc-1 - Old-Title.md" --id doc-10

# 与其他现有更新参数组合，仍在同一次更新中完成
backlog task edit BACK-1 --id BACK-10 -s "In Progress"
backlog decision update decision-1 --id decision-10 --status accepted
```

### 4.3 参数规则

- 查看和更新时，旧 ID 与 `--source-path` 至少提供一个；`--id` 是目标 ID，不能充当源对象选择条件。
- 未提供 `--source-path` 时，位置参数保持必填语义和现有识别行为，包括 `doc-1`、裸 `1` 等等价形式。
- 提供 `--source-path` 且省略旧 ID 时，路径必须精确指向对应实体的一个本地文件，从 frontmatter 取得旧 ID。
- 同时提供旧 ID 和 `--source-path` 时，必须按实体 ID 等价规则校验一致；不一致返回 `SOURCE_MISMATCH`，不能选择其中一个继续。
- `--id` 是可选更新参数，不与 `--title` 组成“至少提供一个”的新约束；现有其他更新操作继续有效。
- 未提供 `--id` 时沿用源对象 ID；未提供 `--title` 时沿用源对象标题。
- `--id` trim 后不能为空，并必须通过对应实体现有规范化和合法性检查。
- `task edit` 支持批量更新，但 `--id` 或 `--source-path` 只能用于一个源任务；多个位置参数与其中任一参数同用时必须在读取文件前拒绝。
- `--id` 可以与现有元数据更新参数组合。主文件内容更新、身份变化、文件更名和引用更新必须纳入同一计划，不能先部分保存元数据再处理更名。
- 规范化后没有任何实际变化时输出 `No changes`，保持幂等且不产生提交。

## 5. 源对象选择与一致性校验

| 模式 | 解析规则 | 重复旧 ID 的处理 |
|---|---|---|
| 仅旧 ID | 完全沿用现有 ID 识别规则 | 返回 `AMBIGUOUS_ID`，列出候选路径及仅使用 `--source-path` 的查看、更新示例 |
| 仅 `--source-path` | 直接定位精确项目相对路径，读取对应实体及 frontmatter 旧 ID | 不需要旧 ID 候选查询，可直接选中一个重复文件 |
| 旧 ID + `--source-path` | 先由路径读取源对象，再复用实体 ID 等价规则与位置参数比较 | 一致则继续；不一致返回 `SOURCE_MISMATCH` |

路径参数不能作为位置参数的新解析分支。只有显式提供 `--source-path` 时才按路径选择文件，因此不会改变现有 `doc-1`、裸 `1` 等位置参数的含义。

一致性判断复用现有规则：任务使用 `taskIdsEqual`，文档使用 `documentIdsEqual`，决策使用共享的 `entityIdsEqual` 语义。例如 `1`、`doc-1`、`doc-01` 可按文档规则视为等价；不同 ID、不同实体、路径不存在或 frontmatter 无效均失败。更新操作必须在任何写入前失败，查看操作不得退而求其次显示另一个对象。

## 6. 统一更新语义

| 场景 | 预期行为 |
|---|---|
| 只改标题，ID 不变 | 保持当前行为：更新标题，按需更名并修复路径与 slug 引用 |
| 只改 ID，标题不变 | 更新 frontmatter ID，文件改为 `<新ID> - <原标题>.md`，同步身份与路径引用 |
| ID、标题都改 | 在同一计划中更新 frontmatter、文件名、身份引用和路径引用 |
| 修改前旧 ID 已重复 | 裸 ID 失败；`--source-path` 可选中一个文件，其他重复文件保持不变 |
| 新 ID 已被占用 | 写入前失败，所有文件保持不变 |
| 新路径已存在 | 写入前失败，禁止覆盖 |
| 标题清洗后路径不变且 ID 不变 | 不执行无意义 rename，仅处理其他实际更新 |

### 6.1 旧 ID 重复不等于新 ID 冲突

如果新旧 ID 按实体规则等价，例如 `doc-1 → doc-01` 或 `BACK-1 → BACK-01`，说明没有引入新的身份冲突。即使旧 ID 已重复，也允许通过 `--source-path` 修改其中一个文件；若规范化后的显示形式变化，则同步 frontmatter 和文件名。

如果新旧 ID 不等价，而其他文件已经占用等价新 ID，则必须拒绝：

```text
doc-1 → doc-2，而 doc-02 已存在
BACK-1 → BACK-2，而 BACK-02 已存在
decision-1 → decision-2，而 decision-02 已存在
```

等价判断必须复用现有规则：任务使用 `taskIdsEqual`，文档使用 `documentIdsEqual`，决策使用共享的 `entityIdsEqual` 语义。

### 6.2 目标路径独立检查

无论 ID 是否变化，排除源文件后，只要目标路径已存在就拒绝。该检查覆盖同目录同 ID 的标题冲突、大小写路径冲突以及并发出现的目标文件。

所有校验必须在任何写入、重命名或删除前完成，预检失败保证零修改。

## 7. 任务专属规则

### 7.1 源文件与查重范围

- 源对象支持 `tasks/` 和 `completed/` 中的本地任务。
- 新 ID 查重覆盖 `tasks/ + completed/`，防止活跃任务与已完成任务冲突。
- 不修改其他分支的远程语料。
- 新 ID 必须使用项目配置的任务前缀，并拒绝 `draft`、`doc`、`decision` 等保留前缀。
- ID 的显示形式、大小写和零填充沿用现有任务规范化与项目配置。

### 7.2 父子任务约束

- 有子任务的任务只允许改标题，不允许直接改 ID。
- 子任务改 ID 时必须保持原父级，例如允许 `BACK-1.1 → BACK-1.2`。
- 不允许通过 `--id` 把顶级任务变成子任务，或把子任务移动到另一个父级；这类需求继续使用现有 reparent 能力。
- 如果其他任务的 `parentTaskId` 已指向源任务，即使源任务没有正常加载出子任务列表，也应按“存在子任务”处理并拒绝改 ID。

整棵子树原子重编号不在首版范围内。

### 7.3 结构化任务身份引用

任务 ID 变化时，以下机器可读引用纳入同一变更计划：

- 其他任务的 `dependencies`。
- 精确匹配源任务 ID 的 `references`。
- 首版约束允许的情况下涉及的 `parentTaskId`。
- 可明确解析的 `/task/:id/:title` 路由中的 ID 段。

扫描范围覆盖持有这些引用的本地活跃、完成和草稿记录。只更新解析后明确指向源任务的字段，不能模糊替换普通文本。

## 8. 文档、决策与 Wiki 引用处理

### 8.1 自动更新的路径和路由引用

路径或 ID 变化时，扩展现有 `FileRenamePlan` 的引用改写范围：

- 本地任务、文档、其他决策和 Wiki 页面中的精确相对路径链接。
- 任务的 `documentation`、`references`、`modified_files`。
- 里程碑的 `documentation`。
- Wiki frontmatter 中精确匹配旧路径的 `source_path`。
- `/documentation/:id/:title` 和 `/decisions/:id/:title` 中可明确解析的 ID 段与标题 slug。
- `/task/:id/:title` 中可明确解析的任务 ID 与标题 slug。

Wiki 目录不存在时直接跳过，不创建目录。不同文件中的相对路径必须根据各自所在目录解析，不能假定所有引用都使用仓库根目录形式。带标题的实体路由没有 `.md` 后缀，必须按路由语义解析，不能仅按文件路径替换。

### 8.2 不自动修改的普通文本

普通正文中的裸 `BACK-1`、`doc-1`、`decision-1` 或其他无法明确判定语义的文本，不进行全仓正则替换。可以在执行结果中列出需要人工检查的匹配位置，但警告不属于文件写入计划，也不影响回滚。

### 8.3 决策专属约束

- 文件位于扁平的 `decisions/` 目录。
- 保持 `date`、`status` 以及 Context、Decision、Consequences、Alternatives 等内容不变，除非同一次命令显式提供了对应更新参数。
- 不额外引入决策模型中不存在的 `updated_date` 字段。

## 9. 现有更新流程与 FileRenamePlan 复用

不建立第二套 rename 事务。三类实体分别扩展现有入口：

- CLI 在对应查看、更新命令上注册 `--source-path`，并在 `task edit`、`doc update`、`decision update` 上注册 `--id`；位置参数或路径用于确定源对象，`--id` 作为独立 `newId` 传入 Core。
- Core 在现有任务、文档、决策更新方法中先解析并读取源对象，再计算目标 ID、标题和路径。
- 标题或 ID 导致路径变化时，继续复用 `FileRenamePlan` 的候选收集、预检、临时文件、no-replace 安装、失败回滚和自动提交能力。
- 在现有计划上增加身份元数据和结构化身份引用更新，不另建重型事务框架。
- 文件名生成与标题清洗继续复用各实体共享实现，避免三套 sanitize 规则漂移。
- 自动提交继续通过现有提交作用域收集主文件新旧路径及所有关联写入路径。

### 9.1 Plan 阶段

1. 仅传路径时直接读取源文件及 frontmatter 原 ID；同时传 ID 和路径时先校验一致；仅传 ID 时按现有规则解析。保留确认后的原 ID 作为查重和引用匹配基准。
2. 规范化 `newId`，校验标题和其他现有更新参数。
3. 计算目标路径。
4. 检查新 ID 冲突、目标路径冲突及任务父子约束。
5. 计算主文件更新、路径引用更新、身份引用更新和人工检查警告。
6. 将全部实际写入文件纳入同一个 `FileRenamePlan`。

### 9.2 Apply 阶段

1. 写入前重新读取所有待修改文件；若内容或文件身份已变化，则中止。
2. 所有新内容先写临时文件。
3. 使用 no-replace 方式安装目标文件，禁止覆盖并发出现的新文件。
4. 任一文件失败时回滚已经修改的主文件和关联文件。
5. 应用成功后统一更新 ContentStore、搜索及相关缓存。
6. 自动提交将所有旧路径、新路径和关联写入路径纳入一次提交。

## 10. 输出与错误

成功输出沿用现有更新命令，并在发生身份或路径变化时增加：

```text
Updated document doc-1 → doc-10
Path: backlog/docs/PRDS/doc-1 - Old-Title.md
  → backlog/docs/PRDS/doc-10 - New-Title.md
Updated references: 3 files
Text references requiring review: 2 files
```

错误约定：

- 旧 ID 与 `--source-path` 均未提供：明确缺少源对象选择条件，非零退出。
- 源 ID 或路径不存在：明确 not found，非零退出。
- ID 与路径不一致：`SOURCE_MISMATCH`，列出位置参数 ID、文件实际 ID 和路径；查看不显示其他对象，更新保证零写入。
- 源 ID 重复：`AMBIGUOUS_ID`，列出候选及使用 `--source-path` 的更新命令。
- 多任务批量更新使用 `--id` 或 `--source-path`：在读取或写入前拒绝。
- 新 ID 冲突：`ID_CONFLICT`，列出新 ID 和占用文件。
- 目标路径冲突：`PATH_CONFLICT`，列出目标路径。
- 任务层级不允许：说明只能改标题或必须使用 reparent。
- 并发变化或应用失败：说明是否已完整回滚；若回滚失败，列出保留的备份路径。

## 11. 测试矩阵

### 11.1 三类实体共同测试

- 现有更新命令只改标题的既有测试全部保持通过，不新增 rename 命令。
- 唯一对象只改 ID、同时修改 ID 和标题。
- `--id` 与其他现有更新参数组合时，主文件和引用一次性提交。
- 旧 ID 重复时仅传裸 ID 失败且零写入；仅传 `--source-path` 可查看、只改标题或改成未使用的新 ID。
- 文档 `doc-1`、裸 `1` 等现有位置参数形式行为不变；仅路径时可省略旧 ID。
- ID 与路径同时提供但 ID 不等价、实体不同或路径无效时返回 `SOURCE_MISMATCH`，查看不显示其他对象，更新零写入。
- 新 ID 已存在，包括大小写、零填充等等价冲突，失败且零写入。
- 目标路径已存在，失败且零写入。
- 无实际变化时幂等，不产生新提交。
- 正文、目录和未指定元数据保持不变。
- 自动提交包含全部新旧路径与关联文件。

### 11.2 任务测试

- 多任务位置参数与 `--id` 或 `--source-path` 同用时明确拒绝。
- 活跃任务与已完成任务之间的旧 ID 重复，可通过 `--source-path` 选择。
- 新 ID 与活跃或已完成任务冲突时零写入。
- 有子任务时改 ID 被拒绝，只改标题成功。
- 子任务改成同父级的新 ID 成功，跨父级被拒绝。
- 所有相关 `dependencies`、精确任务 `references` 和允许的 `parentTaskId` 同步更新。
- `/task/:id/:title` 的 ID 段和 slug 同步更新。
- 任一关联文件写入失败时，源任务和关联任务全部回滚。

### 11.3 文档、决策与 Wiki 测试

- 文档子目录在改名后保持不变。
- 任务或里程碑中的精确结构化路径引用同步更新。
- `/documentation/:id/:title`、`/decisions/:id/:title` 的 ID 段和 slug 同步更新。
- 不同目录中的相对路径分别正确解析，Wiki 不存在时不创建目录。
- 普通 Markdown 裸 ID 文本不被盲目替换。
- 决策另一个重复文件保持字节不变，状态、日期和未指定正文小节保持不变。

## 12. MCP 对齐设计

MCP 与 CLI 共用 Core 的源选择、ID 规范化、冲突预检、文件更名和引用同步，不建立另一套更名流程。

- `task_edit`、`document_update`、`decision_update` 增加可选 `newId` 与 `sourcePath`；`id` 仍可单独使用，仅 `sourcePath` 时从文件 frontmatter 读取旧 ID，同传时必须匹配。
- `task_view`、`document_view` 支持同一组 `id` / `sourcePath` 选择规则；新增 `decision_view`，补齐决策的 MCP 查看能力。
- `newId` 接受裸数字和带前缀 ID。文档更新省略 `content` 时保留正文；决策更新支持独立 `title`，因此三类实体都能只改 ID、只改标题或组合更新。
- 保留既有工具 description 的原始语义，只在末尾追加新能力说明，避免 MCP 客户端依赖的既有契约发生漂移。
- 缺少 `id` 与 `sourcePath` 时由 handler 返回验证错误；`AMBIGUOUS_ID`、`SOURCE_MISMATCH`、`ID_CONFLICT`、`PATH_CONFLICT` 和 `HIERARCHY_CONFLICT` 保留为结构化 MCP 错误码。
- MCP 文档、决策、任务执行和工具概览指南同步说明精确选源、重复 ID 处理和更名引用行为，并通过真实 MCP 调用入口测试 schema、handler 和磁盘结果。

## 13. 验收标准

1. `task edit`、`doc update`、`decision update` 均支持可选 `--id`，不存在平行的新 rename 命令。
2. 未提供 `--id` 时现有更新行为完全兼容。
3. 只改标题、只改 ID、同时修改均能保持文件名、frontmatter 和引用一致。
4. 查看与更新命令均支持仅 ID、仅 `--source-path`、ID 与路径同传三种模式；仅路径时可省略旧 ID，同传不一致时返回 `SOURCE_MISMATCH`，且绝不清理未选中的重复文件。
5. 新 ID 或目标路径冲突时始终写入前失败。
6. 任务批量与父子约束得到执行，结构化身份引用不会指向已腾空的 ID。
7. 文档、决策和任务的精确路径、结构化字段、Wiki 引用及实体路由保持同步。
8. 多文件应用具备并发检测和失败回滚，自动提交覆盖完整变更集，测试矩阵全部通过。
9. MCP 三类更新工具支持 
ewId / sourcePath，三类查看工具支持精确源路径，并新增 decision_view；既有工具描述和 MCP 调用行为保持兼容。
