## v1.48.0-CN Release Notes

> 上一个版本：[v1.47.2-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.47.2-CN)
>
> 本版本根据上游 v1.48.0 的变更差异（见 [doc-4](backlog/docs/migration/doc-4 - Upstream-v1.47.1-to-v1.48.0-Migration-Diff-Classification.md)）**有选择地迁移**了其中适合本项目的部分，并按当前 fork 的定制（自定义任务前缀、本地时区显示、用 label 做分类、独立的 Web 路由等）做了适配。**未迁移**的上游改动见文末。

### 🤖 面向 Agent 与 CLI 的工作流

- **验收标准 / 完成标准（AC/DoD）的编辑更稳定可靠**（BACK-537，迁移上游 BACK-537）— `--ac` 与 `--acceptance-criteria` 在创建和编辑任务时保持"累加"语义不变；新增 `--clear-ac` 一次性清空全部条目，并与累加操作互相排斥；自动维护各章节的顺序、格式和空白，遇到写坏的 AC/DoD 标记会直接报错而不是静默通过
- **重复任务 ID 的检测与修复**（BACK-538，迁移上游 BACK-516）— 能发现 `TASK-1` 与 `TASK-01` 这类拼写等价、合并产生的重复 ID，并提供以人工操作为先的 `backlog doctor` 修复流程；CLI 遇到模糊 ID 时直接拒绝操作，Web 界面同样能修复；同步更新了 AI 指导指南
- **补全草稿（draft）操作指南**（BACK-532）— 新增 `backlog instructions drafts` / `backlog://workflow/drafts`，说明如何创建草稿、promote/demote 后编号会去掉前缀、以及之后怎么继续编辑
- **多行输入不再踩坑**（BACK-547）— 明确提醒：给 `--plan`、`--notes`、`--comment`、`--final-summary` 等多行字段传值时，不要用 bash 的 ANSI-C 引号（`$'...'`），应改用 CLI 自己的 `\n` 转义
- **`doc view --plain`**（BACK-552，迁移上游 BACK-523）— `backlog doc view` 支持 `--plain` 直接输出纯文本，方便脚本调用；非交互终端会自动走纯文本

### 📝 任务与文档的创建、编辑

- **任务描述支持追加**（BACK-530）— `task edit` 新增 `--append-description`（别名 `--append-desc`），和已有的 `--append-notes`、`--append-final-summary` 保持一致；MCP 的 `task_edit` 同步支持
- **文档更新支持多行与追加**（BACK-529）— `doc update --content` 支持 `\n` 换行，新增可重复使用的 `--append-content` 追加内容块；MCP 的 `document_update` 同步支持
- **修复自定义前缀下的编号查找**（BACK-545）— 之前 `task edit` 输入纯数字 ID 会被误转成默认前缀（如 `TASK-544`），现在会正确解析到配置的前缀（如 `back`）对应的任务文件

### 🔍 筛选与排序

- **按状态排除与多选**（BACK-548，迁移上游 BACK-532）— CLI 的任务列表/搜索和 Web 的"全部任务"页支持排除一个或多个状态，`--status` 支持多选；Web 端参照 label 筛选器做了「包含 / 排除」两个下拉框（筛选状态记在网址里）；TUI 汇总视图与 MCP 的任务列表/搜索同步支持
- **筛选未分配任务**（BACK-551，迁移上游 BACK-427）— CLI `task list --unassigned` 与 MCP `task_list` 的 `unassigned` 字段，均与 `--assignee` 互斥；筛选逻辑统一在核心层实现
- **看板列按创建时间排序**（BACK-541，迁移上游 BACK-531）— 看板列菜单新增按创建时间升序/降序排列，和现有的 ID/标题/优先级排序并列；缺失或无效的日期排在最后，同日期用任务 ID 定先后
- **任务列表默认按排序号排列**（BACK-542，迁移上游 BACK-527）— Web 的"全部任务"和 CLI 的 `task list` 默认都按排序号（ordinal）排列，与看板一致；表头点击三次循环「升序→降序→取消恢复默认」；不额外加一列排序号
- **里程碑任务列表加"创建时间"列**（BACK-543，迁移上游 BACK-526）— 每个里程碑卡片里的任务表新增可排序的"创建时间"列，默认按排序号排列、表头三次点击循环；里程碑卡片本身的排序不变
- **浏览器标签筛选按字母排序**（BACK-546，迁移上游 BACK-529）— Web 端标签筛选器按不区分大小写、与区域无关的方式排序（并处理了 Unicode 的 NFC/NFD 差异）

### 🌐 Web 界面

- **任务详情显示 AC 序号**（BACK-544，迁移上游 BACK-517）— 浏览器任务详情里，每条验收标准旁边会显示 `#N` 序号
- **可选隐藏空的看板列**（BACK-549，迁移上游 BACK-466）— 新增 `hideEmptyColumns` 配置（默认关闭），开启后看板不显示没有任何任务的状态列；拖拽任务时会临时显示空列，保证还能把任务拖过去
- **刷新页面不再丢失未保存内容**（BACK-535，迁移上游 BACK-429）— 后台文件刷新时，任务编辑弹窗里尚未保存的本地改动会保留下来，不被旧数据覆盖
- **修复文档内的锚点链接**（BACK-536，迁移上游 BACK-426）— `[链接](#标题)` 这类锚点链接在当前页面内跳转；统一用 github-slugger 生成标题 ID，同时兼容带前缀的人类可读锚点，保存文档时会自动规范化
- **短链接支持指定行范围**（BACK-531）— `/task/:id`、`/documentation/:id`、`/decisions/:id`、`/wiki/*` 等短链接支持 `:N` 或 `:N-M` 指定行范围，点开后在预览框里直接定位到对应行

### 🛠️ 构建与打包

- **浏览器界面改用 Bun 原生构建**（BACK-553，迁移上游 BACK-525）— 构建流程切换到 Bun 原生全栈构建：用 `scripts/build.ts`（`Bun.build` + `bun-plugin-tailwind`）把 React 界面、Tailwind 样式、JS 和 favicon 直接打进编译后的二进制；不再预先生成 `style.css`，也去掉了服务端的 favicon 兜底；同步调整了 `package.json`、`bunfig.toml`、`ci.yml`、`release.yml`、`flake.nix` 和 `DEVELOPMENT.md`，并给 `build.test.ts` 补充了资源与缓存头的断言
- **修复 Apple Silicon 上的二进制解析**（BACK-550，迁移上游 BACK-240）— 在 Rosetta / 架构不匹配的情况下，能正确识别并回退到可用的 darwin 架构包；`cli.cjs` 会输出检测到的平台、架构、Rosetta 状态和重装指引；并修正了此前误查未发布 scoped 包名的问题

### 🐛 数据一致性与配置修复

- **修复 config.yml 里 block-style 列表被忽略**（BACK-533，迁移上游 BACK-540）— `statuses`、`labels` 等写成块式列表（`- item`）时不再被静默忽略；`config get` / `config set` 使用同一份可用键列表，`config set` 对列表键会指向真实可用的命令
- **仅调整排序号不再改动更新时间**（BACK-534，迁移上游 BACK-518）— 只调整任务排序号时不再刷新 `updated_date`，避免任务文件被无意义地改动；内容或元数据有实际变化时仍正常更新
- **防止旧数据覆盖新状态**（BACK-540，迁移上游 BACK-533）— 给任务/文档/决策的数据缓存加了版本守卫，较旧的异步刷新不会再覆盖较新的已保存修改

---

### 未迁移的上游改动（本次评估后跳过）

| 上游功能 | 分类 | 原因 |
|---|---|---|
| 任务 `type` 类型字段（BACK-355） | A1→C18 | 评估后认为单选 `type` 会挤占现有的 `label` 分类，本项目已用 label 承担分类职责，放弃 |
| 任务深链接 `/board/*`、`/tasks/*`（BACK-257） | B1→C17 | 本项目已用统一的 `/task/:id/:title`、`/draft/:id/:title` 路由实现类似能力，上游路径会和现有页面路由冲突 |
| 自定义优先级值（BACK-530） | B2→C15 | 评估后觉得改动面太大、风险大于收益（要放开类型、并重做颜色/排序/筛选/统计/多语言），三档优先级已够用 |
| `dateFormat` 配置统一生效（BACK-421） | B9→C16 | 上游实现建立在"按 UTC 显示"之上，与本项目"本地时区显示"策略冲突；且原生的 `datetime-local` 编辑框无法套用 dateFormat |
| 移除 sequences 功能（BACK-520） | C1 | 本项目仍在使用 `src/core/sequences.ts` 及相关功能 |
| README 重构 / manifesto（BACK-519） | C2 | 偏品牌和文档方向，与本项目文档策略无关 |
| 测试可靠性改造、CI 加速、agent 指南等 | C3–C9 | 上游内部工程与文档方向，与本项目定制无关 |

> 完整的差异分类见 [doc-4](backlog/docs/migration/doc-4 - Upstream-v1.47.1-to-v1.48.0-Migration-Diff-Classification.md)，A 类分析见 [doc-5](backlog/docs/migration/doc-5 - A类上游任务迁移分析报告.md)，B 类分析见 [doc-6](backlog/docs/migration/doc-6 - B类上游任务迁移分析报告（v1.47.1-..-v1.48.0）.md)。
