## 📈 v1.53.13-CN Release Notes
> 上一个版本：[v1.53.12-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.53.12-CN)
>
> 🚀 简单说：这个版本主要改进**改名与 ID 管理**、**Web 文档整理**、**保存反馈**，以及 **Mermaid 和图谱稳定性**。
### ✨ 新功能
- 🗂️ **任务、文档、决策改名时，文件和引用一起更新**
  - 修改标题后，Markdown 主文件会按新标题同步更名，不再只留下一个新标题和一个旧文件名。
  - 修改 ID 继续使用现有的 `task edit`、`doc update`、`decision update`，新增 `--id` 指定新 ID，**不另设 `rename` 命令**。
  - 主文件、frontmatter、任务结构化字段、其他内容里的精确路径引用、里程碑文档字段、Wiki `source_path` 和实体路由会在同一事务中预检、更新；目标冲突或执行失败不会留下半套结果。
  - 不同目录里的相对链接会逐文件重新计算，链接文字、查询参数、锚点及行 / 页范围都会保留。
- 🎯 **重复 ID 不再只能靠猜：可以精确指定源文件**
  - `task view/edit`、`doc view/update`、`decision view/update` 新增 `--source-path`，用项目根相对 Markdown 路径选定唯一来源；提供路径时可以省略旧 ID。
  - 同时提供旧 ID 和路径时会校验二者是否匹配；裸 ID 有多个候选时会列出路径并拒绝猜测。
  - MCP 同步支持 `newId` / `sourcePath`，并新增 `decision_view`；工具总数由 33 个增至 **37 个**。
- 🖱️ **Web 文档与文件夹支持拖放移动**
  - 文档可以拖到目标文件夹，整个文件夹也可以递归移动到另一个位置；移到根目录时放到文档根分组。
  - 合法目标会高亮，自身、后代目录、同名冲突和路径逃逸会被拒绝。
  - 文件夹移动会整组预检其中文档的目标路径与身份，成功后一次提交，失败则整组回滚，不留下只移动了一半的目录树。
- 🗑️ **文档、文件夹和决策可以删除**
  - Web 文档树与决策树提供显式删除入口，执行前有确认提示。
  - CLI 新增 `backlog doc delete`、`backlog doc delete-folder` 和 `backlog decision delete`。
  - MCP 对应新增 `document_delete`、`document_delete_folder`、`decision_delete`。
  - 删除只处理明确选中的源文件；歧义 ID、跨分支候选或结构化子任务式 ID 不会被自动猜测。
- 💾 **即时编辑也有「保存中 / 已保存 / 保存失败」反馈**
  - 任务弹窗的状态、日期、标题、负责人、优先级和里程碑仍即时保存，现在会与列表型字段共用头部保存状态标识。
  - 里程碑侧栏的名称、日期和文档编辑也显示同样的保存状态；成功状态约 2.5 秒后自动消失。
  - 保存中的后续编辑会按既有机制排队合并，普通单值字段没有新增防抖等待。
- 🕸️ **Web 图谱后台预热，并复用已验证快照**
  - 内容服务就绪后就在后台准备图谱，不再等到第一次打开图谱页面时才从零构建。
  - Web、CLI 与 MCP 可以复用带完整解析报告的成功快照；语料指纹、解析器 / schema 版本和快照哈希全部匹配才直接载入。
  - 缺失依赖等 `ParseReports` 会随快照保留，不会再出现「图加载出来了，诊断报告却丢了」。

### 🐞 修复
- 文档标题变化后，其他任务、文档、决策和 Wiki 中仍指向旧文件名的相对链接已能同步修复。
- 任务与决策标题变化现在也会驱动主文件更名，并同步对应的结构化引用、Wiki 回链和实体路由。
- Mermaid 快速切换亮 / 暗主题时，较早发起、较晚完成的渲染不再覆盖新主题结果；新图成功前保留旧 SVG，失败时不再制造空白闪烁。
- Classic 与 Pele 引擎、阅读视图和 Markdown 编辑预览使用一致的重渲行为；treeView 等图表的暗色文字、节点和连线颜色会写入真实 SVG 属性，暗底上恢复可读。
- Windows 写 commit-index 磁盘缓存遇到 `EPERM` 等失败时，不再丢弃已经成功构建的 Git 内存索引，也不会把分支任务误判为空或反复重建未变化提交。
- 缓存临时文件加入进程与时间戳信息，Windows 原子替换复用锁冲突重试，降低并发服务之间的缓存写入冲突。
- CI 安装重试、测试超时、临时目录隔离、进程树清理与 JUnit XML 序列化已分别治理，减少重复重跑仍失败的情况；平台测试范围没有扩大。

### 🧹 行为调整
- 文档标题或 ID 更新只修复**精确匹配**的结构化字段、路径引用、Wiki `source_path` 和实体路由；普通正文中的裸 ID、代码、Wikilink、外部 URL 与无标题短链接不会被全局替换。
- 文档、文件夹和决策删除是**永久移除**，不是归档；任务的 `references` / `documentation` 和正文链接不会在删除后自动清理。
- 图谱启动策略由此前「首次打开时才初始化」调整为「首屏可用后后台预热」；旧快照没有解析报告时会有意重建一次。
- Mermaid 运行环境更新为 **Pele 1.13.0 / Mermaid 12.3.0**。
- 中文、英文用户手册、CLI / MCP 工作流说明与 Wiki 知识库已同步更新。

### 🧩 怎么用
**修改标题或 ID**：
```bash
# 任务同时修改 ID 和标题；文件名与精确引用一起更新
backlog task edit back-1 --id back-10 --title "新标题"
# 文档只修改 ID
backlog doc update doc-5 --id doc-10
# 决策可同时修改 ID、标题和状态
backlog decision update decision-3 --id decision-10 --title "采用 TypeScript" --status accepted
```
**重复旧 ID 时精确选择文件**：
```bash
backlog task view --source-path "backlog/completed/back-1 - Old-Title.md" --plain
backlog task edit --source-path "backlog/completed/back-1 - Old-Title.md" --id back-10
backlog doc update --source-path "backlog/docs/guides/doc-5 - Old-Title.md" --id doc-10
backlog decision view --source-path "backlog/decisions/decision-3 - Old-Title.md" --plain
```
**删除文档、文件夹或决策**：
```bash
backlog doc delete doc-5
backlog doc delete-folder guides/old
backlog decision delete decision-3
```
删除前请先核对候选路径、内容和既有引用；这些命令不会替你清理其他文件里的链接。

**在 Web 中整理文档**：打开文档侧边栏，把文档或文件夹拖到目标位置；需要删除时，从对应条目的更多菜单进入并确认。移动或删除成功后，当前选择和详情地址会按结果刷新。

### ⚠️ 需要注意
- `--source-path` 使用**项目根相对 Markdown 路径**。旧 ID 与路径同时提供时必须匹配，否则报 `SOURCE_MISMATCH`；重复 ID、目标 ID 冲突和目标路径冲突分别按 `AMBIGUOUS_ID`、`ID_CONFLICT`、`PATH_CONFLICT` 拒绝。
- 有子任务的任务不能直接修改 ID；子任务只能在原父级内改号，跨父级移动仍使用 reparent。`--id` 和 `--source-path` 也不能与多任务批量编辑混用。
- 更名事务不会把普通散文里的所有旧 ID 全局替换；如果某段文字本身需要改写，请单独编辑。
- 删除不会自动清理任务字段或正文引用，也不会把跨分支候选当成可写目标。
- 保存状态标识表示请求结果，**不等于所有输入都会回滚**：日期、标题或里程碑侧栏写入失败时，当前输入值仍可能保留，请根据错误提示重试或修正。
- 图谱预热不阻塞首屏 API，但准备期间仍可能出现短暂主线程卡顿，并不代表整个启动过程完全无阻塞。

### ⬆️ 升级说明
- ✅ **直接升级，不用改配置、不用迁移数据**；既有任务、文档和决策不会在升级时被批量改名，只有后续标题或 ID 更新才触发对应更名事务。
- 现有更新命令新增 `--id` / `--source-path`，查看命令新增 `--source-path`；没有新增独立 `rename` 或 dry-run 工作流。
- MCP 调用方可使用 `newId` / `sourcePath`，文档与决策新增删除工具，决策新增 `decision_view`。
- 中文、英文用户手册和 Wiki 已同步更新，升级前无需手工修改旧链接；之后发生实体更名时会按精确引用规则处理。

### 🐞 已知问题
- macOS CI 的 `bun install` 在外层重试耗尽 10 分钟时仍可能失败，这项安装基础设施问题不能视为已经完全关闭；不影响本版功能契约。
- 图谱快照准备期间仍可能有主线程短暂卡顿。
- 保存失败后的部分日期、标题和里程碑输入不会自动恢复原值，与既有编辑行为一致。

> 本版对应任务：BACK-848 ~ BACK-861；关联设计文档：doc-36。
