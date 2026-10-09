## v1.53.4-CN Release Notes

> 上一个版本：[v1.53.2-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.53.2-CN)
>
> 这是一个**补丁版本**，覆盖 2026-10-08 ~ 2026-10-09 的 4 个任务（BACK-759 ~ BACK-762）。核心修一类问题：**自定义 `task_prefix` 的项目跨分支任务加载整体失效**（看板/列表/搜索看不到其他分支的任务，任务 ID 分配退化为本地、引发撞号）。同时把"跨分支可见性"与"终止状态"两个此前隐式的概念落成显式配置与显式接口。无数据迁移。

### 🎯 主要亮点

- **跨分支加载修复 + 可配置化**（BACK-759/760）：自定义前缀（如本仓库 `task_prefix: "back"`）的项目，跨分支索引此前恒为空——其他分支的任务对 Web 看板、`task list`、搜索完全不可见，ID 分配也因此撞号（BACK-715 事件）。根因是文件名解析漏传前缀，一行修复；在此基础上新增配置项 `include_cross_branch`，并在高级设置页给出开关，扫描（`check_active_branches`）与展示（`include_cross_branch`）两条轴都可在 UI 调整。
- **终止状态显式化**（BACK-761/762）：终态卡片现在直接显示实际完成时间（`actualEnd`）；`config list`、`/api/config`、`/api/statuses` 全部显式返回派生的 `terminalStatuses`，设置页不再提供会暗中改写 `category` 的"终止状态"多选——状态机编辑器成为唯一修改入口。

---

### 🐛 缺陷修复

#### 自定义 task_prefix 导致跨分支加载失效（BACK-759）

- **症状**：配置了非默认 `task_prefix` 的项目，只存在于其他分支的任务在任何跨分支消费方都不可见（Web UI、`backlog task view <id>`、sequences、依赖解析）；`backlog task create` 在落后 main 的分支上分配的 ID 与 main 撞号。
- **根因**：`src/core/task-loader.ts` 的 `extractConfiguredTaskId` 调用 `extractTaskIdFromFilename(filename)` 时**漏传已解析好的 prefix**，文件名永远按硬编码默认 `"task"` 匹配，`back-*.md` 全部返回 `null`，每个分支的提交索引都建成空。默认前缀的项目恰好不会触发，测试夹具也用的默认前缀，缺陷因此长期存活。
- **修复**：一行改动——`extractTaskIdFromFilename(filename, prefix)`。本仓库实测：分支索引条目 0 → 2418（跨 main/release/wiki-tmp），查询语料 400 → 444，落后分支上 `task view BACK-758` 从 not found 变为可读，ID 分配候选集 705 → 749。
- **注意**：`include_cross_branch`（下述新配置）只管"进不进列表"，**不会**停掉扫描；扫描由既有的 `check_active_branches` 控制。两者共用同一条加载路径，ID 分配始终依赖扫描结果。

#### 终态卡片不显示完成时间（BACK-761）

- **症状**：进入终态列（如 Done）的卡片没有任何"何时完成"的信息；`actualEnd` 数据早已在转入终态时落盘（BACK-492），只是从未渲染。
- **修复**：卡片页脚负责人右侧新增完成时间戳——UTC `actualEnd` 转本地时间，格式 `M/D HH:mm`（当年省略年份，跨年显示完整年份），悬停显示规范 UTC 值，与卡片其他日期约定一致；纯日期值（无时分）不做时区偏移。无负责人时仍右对齐。
- **连带修复**：终态判定从硬编码 `"Done"` 改为读项目配置（`getTerminalStatuses` / 新增 `isTerminalStatusName`）。期间发现并修掉一个二次派生 bug：把已派生的名字集合再传给吃原始配置的谓词，导致 `["Done","Dropped"]` 被误判为只有 `Dropped` 是终态、所有 Done 卡片不显示时间戳。同一谓词现在也守卫逾期红边与超期红色。

---

### ✨ 新增能力

#### `include_cross_branch` 配置项（BACK-759）

- `backlog/config.yml` 新增布尔键 `include_cross_branch`（字段 `includeCrossBranch`，同时接受 camelCase 别名），**默认 false（本地优先）**。
- 语义：**配置为默认值，请求参数为覆盖**。`task list`、`board`、`/api/tasks`、`/api/search` 都读它；HTTP `crossBranch` 参数存在时优先。判定统一收敛到一个纯函数 `resolveCrossBranchVisibility`，两个 HTTP 面不会漂移。
- 搜索语料仍恒跨分支构建，过滤发生在查询期——开关切换无需重建索引。
- 支持热更新（config-watcher 识别新键，改 yml 无需重启）。
- CLI 的 9 处写入/查找类调用（`task view` / `edit` / `deps` / `sequences` / milestone 等）刻意保持本地优先，不受此键影响。

#### 高级设置页新增三个控件（BACK-760）

- **跨分支任务**（`includeCrossBranch`）：其他分支的任务是否进入看板/列表/搜索。
- **检查活跃分支**（`checkActiveBranches`）：是否扫描其他本地分支——文案明确说明关闭后任务 ID 分配将收窄到当前分支。
- **活跃分支天数**（`activeBranchDays`，默认 30）：仅在扫描开关打开时渲染。
- 四语言（en / zh-CN / zh-TW / ja）文案齐备；保存为显式操作（Save Changes 后才写入 yml），保存后无需重启即生效。

#### 终止状态显式化（BACK-762）

- `backlog config list` 在 `statuses` 行后新增 `terminalStatuses: [Done, Dropped] (derived from statuses)`，后缀标明它是派生值、不可设置。
- `GET /api/config` 返回只读 `terminalStatuses`（展开拷贝，不会写回 config.yml）；`GET /api/statuses` 从裸数组升级为 `{ statuses, terminalStatuses, defaultStatus }`，Web 客户端两种形状都兼容。
- 设置页的"终止状态"多选**移除**，改为只读展示 + 指引文案（终态由各列 `category` 派生，请到状态机编辑器修改）。此前该多选与状态机编辑器写同一个字段，是"第二入口"。
- 纯字符串数组形式 statuses 的项目按 legacy 规则仍报告最后一列为终态。

---

### 🧪 质量基建

- 新增回归测试锁定每个修复点：
  - `shared-branch-task-loader.test.ts`：自定义前缀（`back`）夹具，修复后通过、回退修复后必失败。
  - `cross-branch-visibility.test.ts`（新文件）：`resolveCrossBranchVisibility` 四种参数×配置组合、yml 双拼写、saveConfig 往返、搜索过滤两条路径。
  - `server-statuses-endpoint.test.ts`：新 `/api/statuses` 载荷形状、字符串数组兜底、`default_status` 优先级，以及"把 `/api/config` 响应原样回写不会把 `terminalStatuses` 种进 config.yml"。
  - `date-display.test.ts`：新增 `formatStoredUtcShortStamp` 的当年/跨年/纯日期/非法输入用例；`terminal-status.test.ts` 锁定二次派生修复。
- 定向套件全绿：shared-branch-task-loader 27/27、cross-branch-visibility 8/8、搜索回归批 63/63、terminal-status + state-machine + date-display 64/64、server-statuses-endpoint 11/11。
- `bunx tsc --noEmit` 干净（同时证明四个语言文件键完整）；`bunx biome check` 在所有改动文件上干净。
- 构建/发布：修复 npm publish（f149e74e）。

---

### ⚙️ 版本与升级说明

**命令面 / 契约变化**

- 新增配置键 `include_cross_branch`（默认 false）。CLI 各命令接口不变。
- `GET /api/statuses` 响应从 `string[]` 变为 `{ statuses, terminalStatuses, defaultStatus }`——**直接消费该接口的外部脚本需要适配**；官方 Web 客户端已兼容两种形状。
- `config list` 输出新增一行 `terminalStatuses`（派生值，不可 `config set`）。

**需要留意的行为变化**

- **Web 看板默认变为本地优先**：此前前端无条件追加 `crossBranch=true`，看板始终显示其他分支任务；升级后默认只显示当前分支，需要时在 设置 → 高级设置 → 跨分支任务 打开（或 yml 写 `include_cross_branch: true`）。
- 自定义 `task_prefix` 的项目升级后，其他分支任务的可见性与 ID 分配恢复正常；此前在落后分支上误分配的撞号任务（如 BACK-715 事件）需人工核对一次。
- 设置页不再能直接改"终止状态"；要调整某列是否终态，请用状态机编辑器修改该列的 `category`。
- Web 前端在服务启动时打包，升级后需重启 `backlog browser` 才能看到卡片完成时间戳与设置页变化。
- 无数据迁移需求。

---

### 未跟进

- 跨分支水合在 Windows 并发下偶发 `Failed to hydrate task ... Git command failed` 警告（文件实际存在、`git show` 可取，判定为子进程竞态，不影响结果，`task view` 仍返回成功）。如可复现，另立任务处理。
- `mcp-memos > deletes a memo` 的 Windows afterEach watcher/rm 竞态超时（1.53.2-CN 已记录），本期未处理。
