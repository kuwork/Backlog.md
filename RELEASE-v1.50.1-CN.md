## v1.50.1-CN Release Notes

> 上一个版本：[v1.49.3-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.49.3-CN)
>
> 本版本根据上游 [MrLesk/Backlog.md](https://github.com/MrLesk/Backlog.md) `v1.49.3 .. v1.50.1`（含 `v1.50.0` 与热修复 `v1.50.1`）的变更差异（详见 [doc-9](backlog/docs/migration/doc-9%20-%20Upstream-v1.49.3-to-v1.50.1-Migration-Diff-Classification.md) 与 [doc-10](backlog/docs/migration/doc-10%20-%20v1.49.3-至-v1.50.1-上游任务迁移分析报告（按领域）.md)）**有选择地迁移**了适合本项目的部分，并按当前 fork 的定制做了适配。**未迁移**的上游改动见文末。

### 🎯 主要亮点

- **CLI 性能回归修复**（对应上游 v1.50.1 热修复）：常用任务命令走本地工作副本快路径，不再为单次读取加载跨分支语料或抓取远端；跨分支加载本身改为增量快照 + 共享缓存，warm 读取从约 394 次 Git 操作降到 ≤3 次（BACK-600 / BACK-601 / BACK-602）。
- **并发编辑不再静默丢数据**：第二个写入者会收到明确错误（Web 409 / MCP `OPERATION_FAILED`），而不是悄悄覆盖（BACK-571）。
- **defaultAssignee 全面生效**：任务创建时自动指派默认值，支持显式取消指派（三态语义：未提供=用默认值、显式空列表=不指派），Web 创建表单预填可移除 chip（BACK-579 / BACK-581 / BACK-584 / BACK-585）。
- **TUI 体验一致性簇**：任务创建器修复、vim 键边界导航、filter 弹窗 vi 导航、隐藏空看板列（`Shift+H`）、窗口标题含项目名、过滤提示统一（BACK-587 ~ BACK-591 / BACK-594）。
- **依赖就绪指引**：CLI `--ready`、TUI 详情行、Web 徽标、MCP `ready` 参数统一提示任务是否可以开工（BACK-615）。
- **里程碑升级**：Web 里程碑详情页与编辑模态框、created/updated 日期字段、documentation 字段、归档/删除语义澄清（BACK-580 / BACK-618 / BACK-619 / BACK-622）。

### ⚡ 性能与架构（上游 v1.50.1 热修复）

- **本地快路径**（BACK-600）：`task view`、`task edit`、`task list` 等常用命令直接读取本地文件系统，不初始化 ContentStore、不触碰 Git；输出与旧路径完全一致。
- **增量跨分支加载**（BACK-601 / BACK-602）：为长驻表面（Web UI、看板、MCP）移植上游 BACK-624——不可变 tip 快照 + 共享 commit/blob 缓存 + 有界 fetch（10s 硬超时 + 60s ref 租约 + 请求合并），由带正确性门控的基准脚本守护。
- **有界远端操作**：fetch 合并、限时、离线优雅降级，不再挂起（BACK-602）。
- 注意：fork 保留了跨分支可见性设计，CLI 本地未命中时仍会回退到跨分支解析（与上游「本地优先且不回退」的行为差异是有意的）。

### 📝 任务创建与编辑

- **列表字段 set 语义**（BACK-577 / BACK-578）：`task edit` 的 `--ref` / `--doc` / `--dep` 统一为 set 语义，新增 `--add-*` / `--remove-*` 增量标志与 `--clear-*` 原子清空；**空值报错并提示 `--clear-*`**（此处与上游「显式空值=清除」刻意分叉，保持 fork 语义一致，见 doc-10 CLI-4）。
- **并发编辑保护**（BACK-571）：per-task 文件锁（fail-fast，无等待/合并/重试），锁内重读，杜绝静默丢写。
- **defaultAssignee**（BACK-579）：从文档化的死配置变为 `string[]` 全表面生效，默认值应用在 core 创建漏斗层，一处生效、CLI/wizard/TUI/Web/MCP 全覆盖；配置 watcher 对畸形值有保护。
- **显式取消指派**（BACK-584 / BACK-585）：CLI/Web/MCP 三态载荷（absent / 显式 `[]` / 列表）；`task create` 多重 `-a` 赋值与 edit 对齐。
- **可清空的 defaultEditor**（BACK-586）：`config set defaultEditor ""` 与 `init --default-editor ""` 两条清空路径。

### 🖥️ TUI

- **任务创建器修复**（BACK-587）：picker 初始高亮、itemRenderer 重复标签、help 弹窗裁剪三个缺陷修复。
- **vim 键边界导航**（BACK-588）：`j`/`k` 在列表边界停留，方向键保持移交搜索，无需新配置键。
- **filter 弹窗 vi 导航**（BACK-589）：移植 PR #809，单选 filter 弹窗与创建器 picker 支持 `j`/`k`。
- **隐藏空看板列**（BACK-590）：`hide_empty_columns` 配置驱动 TUI，乐观翻转 + 失败回滚，退出时 await 挂起写入。
- **窗口标题含项目名**（BACK-591）：`formatTuiTitle` 共享助手，退出时恢复终端标题（含 tmux DCS 透传）。
- **过滤提示统一**（BACK-594）：看板与任务列表 footer 提示对齐，抽到 `footer-content.ts` 常量。
- **焦点恢复**（BACK-616）：`applyFilters` 重建列表后不再丢失键盘焦点。

### 🖥️ Web 界面

- **隐藏列拖拽修复**（BACK-573）：`hideEmptyColumns` 开启时隐藏列在中途拖拽显示为放置目标（延迟一个 macrotask，避免 Chromium 原生拖拽被同步布局中止）。
- **任务列表适配**（BACK-613）：内容宽度列 + 弹性 Title，无横向滚动，过滤栏单行，主题化滚动条。
- **实体 ID 自动链接**（BACK-614）：Markdown 中的任务/文档/决策 ID 渲染为深链，输入端带前缀自动补全。
- **里程碑详情页**（BACK-580）：详情视图 + 编辑模态框，交互全面镜像任务详情页。
- **评论闭环**（BACK-617 / BACK-623）：preview 模式直接添加评论（反转此前的 edit-only 门控）；`--remove-comment` / `--clear-comments` 全表面删除，Web 逐条删除 + 清空按钮。
- **对话框与空态**（BACK-620 / BACK-622）：References/Documentation 空态提示修复；里程碑归档/删除改用样式化模态框并澄清语义（仅 remove 修改任务文件）。

### 📄 文档、决策与身份

- **decision 命令组**（BACK-574）：`backlog decision list/view/update` + 任务列表式双 pane 交互浏览器；`generateNextDecisionId` 去重并移除 core→CLI 动态 import（BACK-576）。
- **doc list 交互浏览器**（BACK-575）：复用同一双 pane 交互模型。
- **doc create --plain**（BACK-592）、**doc view 消歧**（BACK-598：裸 ID / 相对路径 / 标题 slug 三种引用形式）。
- **文档/决策身份 fail-closed**（BACK-596）：歧义立即报错（CLI 退出码 1 / 服务器 409 / MCP `AMBIGUOUS_ID` / Web 共享通知），错误附可直接运行的候选提示。

### 🤖 Agent 与 CLI 工作流

- **wiki install 指引**（BACK-570）：CLI banner、agent nudge 与双 README 补充 `backlog wiki install` 安装指引。
- **agent 指南约定**（BACK-572 / BACK-582）：日期字段本地时区输入、多行字面 `\n`、禁用 bash ANSI-C 引号；agent 首轮必须先加载项目实况（`backlog config list --plain`）再作答；清理 MCP 指南中的死路径指导。

### ⚙️ 配置与数据一致性

- **config 畸形值保护**（上游 #877 / #882 适配）：watcher 对坏值回退到最后一个好值，不再静默应用默认值或污染其他键的解析。
- **gray-matter 缓存投毒修复**（BACK-599）：`frontmatter.ts` 作为唯一解析入口，空 options 禁用缓存，新调用点必须走该包装器。
- **ContentStore 文档 watcher**（BACK-595）：身份寻址、重试退避、重命名/零填充 ID 对账、文件夹删除全套修复。
- **identity-index 真实 bug 修复**（BACK-612）：从 stale `activeTasks` 重建改为从 `cachedTasks` 重建。
- **launcher scoped 包名解析**（BACK-621）：从主包自身 `package.json` name 推导 scope，修复 BACK-550 引入的回归。
- **BACKLOG_CWD 与运行时 Core**（BACK-593）：`createRuntimeCore()` 成为唯一 Core 构造路径，子目录/BACKLOG_CWD 场景读写一致。

### 🏗️ 里程碑增强

- **created_date / updated_date 字段**（BACK-618）：随 `{...spread}` 透传 + 实质变更投影自动刷新，零函数签名改动。
- **documentation 字段**（BACK-619）：`--doc` / `--add-doc` / `--clear-docs`，CLI/MCP/Web 经 MilestoneHandlers 一次实现三 surface。

### 🔧 测试与工程

- 测试稳定化簇（BACK-597 / BACK-603 / BACK-604 / BACK-606 ~ BACK-612）：显式 per-test 超时、JSDOM 全局钉桩、主题自适应/i18n 断言同步，全量测试基线恢复到可信任状态。
- Windows 符号链接 checkout 成为 CI 环境契约（`core.symlinks=true`，BACK-605）。

---

### 未迁移的上游改动（本次评估后跳过）

| 上游功能 | 原因 |
|---|---|
| 多行 flag 文档（#864） | fork 已在 CLI/skill 实现 `processCliEscapes`，语义等价 |
| Rosetta stderr 泄漏（#857） | macOS 专属探测，fork 无 rosetta 代码 |
| 浏览器初始化错误清 loading（#842） | fork 已有 `browser-loading-state.ts`（BACK-566 定制） |
| 删死 TUI 视图文件（#844） | fork 视图结构已自行裁剪 |
| ubuntu CI epoll 抖动修复 | fork 无 `test-preload.ts` / `run-ci-tests.ts` 两个前提，机制上不受困 |
| `TaskListFilter.ready` 字段 | Core 从不处理该字段（静默无操作），属死代码 |
| 上游 3 个服务端测试 | 依赖 fork 没有的上游路由/API，丢弃并记录理由 |
| CLI 本地未命中的 fail-closed 提示（LOCAL_TASK_LOOKUP_HINT） | fork 有意保留跨分支可见性回退，与本地优先快路径并存 |

> 完整的差异分类与逐条迁移建议见 [doc-9](backlog/docs/migration/doc-9%20-%20Upstream-v1.49.3-to-v1.50.1-Migration-Diff-Classification.md) 与 [doc-10](backlog/docs/migration/doc-10%20-%20v1.49.3-至-v1.50.1-上游任务迁移分析报告（按领域）.md)；三次迁移波次的 To-Do 清算见 [doc-16](backlog/docs/migration/doc-16%20-%20To-Do-任务与上游迁移v1.47.1-v1.50.1对照分析报告.md)。
