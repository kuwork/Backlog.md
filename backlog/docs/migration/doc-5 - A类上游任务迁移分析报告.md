---
id: doc-5
title: A类上游任务迁移分析报告（v1.47.1 .. v1.48.0）
type: guide
created_date: '2026-07-28 00:07'
updated_date: '2026-08-09'
---
# A类上游任务迁移分析报告（v1.47.1 .. v1.48.0）

本报告对应 `doc-4` 中 **A类（必须合入）** 条目，逐项分析上游任务核心目的、变更内容、与当前 fork 的交集风险、适合迁移的部分、需要调整/排除的部分、迁移优先级与建议。所有原始任务文件已作为 draft 导入到 `backlog/drafts/`，通过 `DRAFT#N` 链接可查看。

> 分析前提：当前 fork 已演进的能力以 `references/current-branch-migration-exclusions.md` 为准；涉及里程碑时间字段、任务日期字段、甘特图、统计页面的上游改动均已按排除清单原则处理。

---

## A1：BACK-355 任务类型字段（父任务 + 6 子任务）

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 为任务引入一个互斥的 `type` 字段（bug/feature/enhancement/task/chore/docs/spike），支持项目级配置，端到端覆盖 core 模型、持久化、CLI、MCP、TUI 看板/详情、Web UI 卡片/详情及过滤。 |
| **变更内容摘要** | 上游拆分为 6 个子任务实现：draft-22（core 模型与 YAML 持久化）、draft-23（CLI `--type` 创建/编辑）、draft-24（MCP `type` 参数）、draft-25（任务列表/搜索过滤）、draft-26（TUI 展示与过滤）、draft-27（Web UI 展示/编辑/过滤）。 |
| **与当前定制代码的交集风险** | 中。当前 fork 已在 `backlog/tasks/back-355*` 中规划但状态为 To Do；`type` 字段是新增字段，与现有日期字段、甘特图、统计页面等演进能力无直接冲突，但需确保 Web UI 路由/统计页面/甘特图不互相覆盖。 |
| **适合迁移的内容** | 全部适合迁移。Core 类型与持久化、CLI/MCP 创建编辑、配置 `types`、TUI/Web 展示与过滤均可参考上游完成当前 fork 的 back-355 规划。 |
| **需要排除/调整的内容** | 必须采用上游最终设计：缺失 `type` 键保持 **untyped**（不默认注入 `task`），写入时按配置类型集验证；不要回退为“默认 type = task”。 |
| **迁移优先级** | ~~A类（必须合入）~~ —— **已放弃（用户决策 2026-08-09）** |
| **迁移建议** | **跳过（用户决策 2026-08-09）**。原建议参考重写，以当前 fork 的 `backlog/tasks/back-355` 为父任务按上游 6 个子任务实现；但用户评估后判定单选的 `type` 字段看似锦上添花，实则会边缘化现有 `label` 分类的使用（`type` 与 `label` 语义重叠，分散用户对 label 的分类依赖），当前 fork 已用 label 承担分类职责，决定放弃。`backlog/tasks/back-355*` 的规划保留为 To Do 状态不再推进。 |

---

## A2：BACK-516 重复任务 ID 检测与修复

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 检测 `TASK-1` 与 `TASK-01` 等等价拼写或合并后产生的重复 ID，提供人类优先的诊断和修复工作流；CLI 对模糊 ID 操作 fail-closed；Web UI 共享同一能力。 |
| **变更内容摘要** | 新增碰撞检测工具、CLI 诊断/修复命令、确定性文件级修复、回滚所有权加固、Web UI 诊断/修复界面、覆盖巨大/padded/dotted/legacy/stale-plan 等场景的测试。 |
| **与当前定制代码的交集风险** | 中。当前 fork 已有 `normalizeTaskId`、`taskResolutionStrategy` 和跨分支任务解析逻辑，但无重复 ID 诊断工作流。迁移需与现有 `task-path.ts`、`prefix-config.ts` 及分支解析集成。 |
| **适合迁移的内容** | 诊断/修复工作流、CLI fail-closed 模糊 ID 操作、Web UI 共享能力。 |
| **需要排除/调整的内容** | 上游实现基于上游任务身份与分支模型；当前 fork 支持自定义前缀、零填充、点号子任务、跨分支解析，不能直接复用，需结合当前结构重写。回滚/所有权逻辑需适配当前文件系统操作。 |
| **迁移优先级** | A类（必须合入）——数据完整性修复。 |
| **迁移建议** | 参考重写。参考上游设计，但基于当前 fork 的 `task-path`、`prefix-config` 和分支解析实现碰撞检测与修复。 |

---

## A3：BACK-537 AC/DoD 确定性编辑

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 使验收标准（AC）和 Definition of Done（DoD）的 CLI 编辑与 Markdown 序列化确定性化，同时保持 `--ac` 与 `--acceptance-criteria` 作为累加别名（不采用上游的 `--acceptance-criteria` 整体替换语义），新增 `--clear-ac` 原子清除，并拒绝与增量操作混用。 |
| **变更内容摘要** | 共享 checklist 解析/序列化器、CLI `--clear-ac` 编辑语义、MCP `acceptanceCriteriaClear` 字段、帮助文案与指南说明、大量回归测试（含逗号、CRLF、边界空白等）。 |
| **与当前定制代码的交集风险** | 低。当前 fork 刚增强 `task edit`（BACK-530 `--append-description`），但 AC/DoD 编辑语义可独立增强；MCP schema 已存在 `acceptanceCriteriaSet/Add/Remove/Check/Uncheck`，只需新增 clear 字段。 |
| **适合迁移的内容** | 共享 checklist resolver 的确定性序列化能力（章节顺序、空白、CRLF、自定义内容保留）、`--clear-ac` 原子清除、MCP `acceptanceCriteriaClear`、错误提示文案。 |
| **需要排除/调整的内容** | **不照搬**上游将 `--acceptance-criteria` 改为整体替换的设计；当前 fork 保持 `--ac` 与 `--acceptance-criteria` 语义一致（均为累加）。如需整体替换，指南中明确说明：先 `--clear-ac` 再 `--ac` 重新添加，或直接用文本编辑器修改任务 Markdown。`task create` 行为保持不变。 |
| **迁移优先级** | A类（必须合入）——CLI/MCP 编辑语义确定性化，同时保持当前 fork 的别名一致性。 |
| **迁移建议** | 参考重写。复用上游共享 checklist resolver 的序列化与错误检测能力，但 CLI 端只引入 `--clear-ac`，不引入 `--acceptance-criteria` 替换语义；同步更新 MCP schema、handler 与 agent/CLI/MCP 指南。 |

---

## A4：BACK-540 修复 config.yml block-style YAML list

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复 `statuses`/`labels`/`types`/`priorities` 的 block-style YAML 序列（`- item`）被静默忽略的问题，并修正 `config set` 对列表键的指引。 |
| **变更内容摘要** | `parseConfig` 使用 gray-matter 真正解析 YAML 列表键，保留 inline flow 数组作为 legacy fallback；`config set` 对数组键给出统一且指向真实命令的提示；`config get` 与 `config set` 的可用键列表一致。 |
| **与当前定制代码的交集风险** | 低。不涉及排除清单中的核心定制能力；仅影响配置解析层。 |
| **适合迁移的内容** | block-style YAML 列表解析、config set 错误提示统一。 |
| **需要排除/调整的内容** | 若当前 fork 已支持 block-style YAML 则可跳过；迁移后需确保与现有自定义优先级/任务类型能力兼容。 |
| **迁移优先级** | A类（必须合入）——修复 hand-edited config 被静默忽略的 bug。 |
| **迁移建议** | 直接复用。修改 `parseConfig` 和 `config set` 指引文案。 |

---

## A5：BACK-533 防止陈旧 ContentStore 刷新覆盖新状态

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复较旧的异步 ContentStore 刷新在更新持久化写入完成后覆盖较新内存状态的问题。 |
| **变更内容摘要** | 在 ContentStore 为 tasks/documents/decisions 增加 publication generation/epoch 守卫；直接写入使旧刷新失效；watcher 重新绑定与生命周期加固；新增确定性竞争回归测试。 |
| **与当前定制代码的交集风险** | 中。当前 fork 的 ContentStore 已有 refresh 函数和 watcher，但无 generation/epoch 守卫。改动需与现有 root 生命周期、配置 watcher、统计/概览数据流兼容。 |
| **适合迁移的内容** | per-item generation guard、root epoch、目标加载失效、确定性竞争测试。 |
| **需要排除/调整的内容** | 不能直接替换当前 ContentStore；需在当前结构基础上增量加入守卫，避免影响现有 watcher 语义和 overview/gantt 数据刷新。 |
| **迁移优先级** | A类（必须合入）——数据一致性修复。 |
| **迁移建议** | 参考重写。参考上游 epoch/generation 设计，但适配当前 ContentStore 与 root 生命周期。 |

---

## A7：BACK-518 ordinal-only 重排不更新 updated_date

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 当仅修改任务 ordinal（排序号）时，不 bump `updated_date`，避免无意义变更污染任务文件；若同时修改内容/元数据，则正常更新。 |
| **变更内容摘要** | 将 `updated_date` 时间戳逻辑集中在 `Core.updateTask`：对 ordinal-only 保存恢复原有 `updated_date`；对直接编辑、bulk update、同列重排等批量流程统一处理；新增回归测试。 |
| **与当前定制代码的交集风险** | 低。只涉及任务写入时 `updated_date` 的判定逻辑，与当前 fork 的日期字段体系（UTC 存储、本地时区展示）无冲突。 |
| **适合迁移的内容** | `Core.updateTask` 中的 ordinal-only 判定逻辑、直接/批量重排回归测试。 |
| **需要排除/调整的内容** | 确保与当前 fork 的 `includeDateTimeInDates`、空字符串清除日期等已有逻辑不互相覆盖；保持 `updated_date` 缺失时不再新增。 |
| **迁移优先级** | A类（必须合入）——避免无意义变更污染任务文件。 |
| **迁移建议** | 直接复用。修改 `Core.updateTask` 及相关批量更新路径。 |

---

## A8：BACK-429 保留未保存 Web draft 跨越文件刷新

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 当后台文件刷新时，保留 Web UI 中用户正在编辑但尚未保存的 create/edit draft 内容。 |
| **变更内容摘要** | 修改 `TaskDetailsModal` 刷新处理：合并新数据到未修改字段，保留本地 dirty 字段；新增回归测试。 |
| **与当前定制代码的交集风险** | 低。只影响 Web UI 弹窗状态管理。 |
| **适合迁移的内容** | 弹窗刷新合并逻辑与相关回归测试。 |
| **需要排除/调整的内容** | 需确保与当前 fork 的日期清空/空字符串逻辑不冲突，本地编辑不应被外部刷新覆盖。 |
| **迁移优先级** | A类（必须合入）——防止数据丢失。 |
| **迁移建议** | 直接复用/参考重写。修改 `TaskDetailsModal` 状态处理。 |

---

## A9：BACK-426 修复文档内 markdown hash 链接

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 使渲染后的文档/任务中 `[link](#heading)` 类 hash 链接在当前 markdown 路由上下文内跳转，而不是离开当前页面。 |
| **变更内容摘要** | 在共享 `MermaidMarkdown` 渲染器中解析 `#anchor` href，将其解析为当前路由 + hash；新增回归测试。 |
| **与当前定制代码的交集风险** | 低。只影响 Web markdown 渲染器。 |
| **适合迁移的内容** | hash-only 链接解析逻辑与回归测试。 |
| **需要排除/调整的内容** | 确保不影响 docs/decisions 外部链接或已有 `<base href="/">` 行为。 |
| **迁移优先级** | A类（必须合入）——Web UI bug 修复。 |
| **迁移建议** | 直接复用。 |

---

## A10：BACK-240 修复 Apple Silicon 二进制解析

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 Rosetta/arch 不匹配环境下（Node/Bun 以 x64 运行，OS 为 arm64），`scripts/resolveBinary.cjs` 能正确解析并回退到可用的 darwin 二进制包。 |
| **变更内容摘要** | `resolveBinary.cjs` 增加 darwin arm64/x64 双向回退；`cli.cjs` 输出平台/arch/Rosetta 状态与重装指引；README 新增 Apple Silicon 故障排除章节。 |
| **与当前定制代码的交集风险** | 低。只涉及打包脚本与启动器。 |
| **适合迁移的内容** | darwin 架构回退、错误/帮助输出、README 故障排除。 |
| **需要排除/调整的内容** | 当前 fork 的 npm 包名可能与上游不同（如 `@kuwork/backlog.md-...`），迁移时需将包名逻辑适配为当前发布配置。 |
| **迁移优先级** | A类（必须合入）——兼容性修复。 |
| **迁移建议** | 参考重写。参考上游回退逻辑，但适配当前包名与发布流程。 |

---

## 总结

- **直接复用**即可完成的条目：A4、A7、A8、A9。
- **需参考重写**的条目：A2、A3、A5、A10。
- **A1（BACK-355 任务类型字段）已放弃（用户决策 2026-08-09）**：用户评估后判定单选的 `type` 字段看似锦上添花，实则会边缘化现有 `label` 分类的使用，当前 fork 已用 label 承担分类职责，决定不迁移。`backlog/tasks/back-355*` 规划保留为 To Do 状态不再推进。
- **A2 与 A5 是当前 fork 数据完整性与一致性短板**，为 A 类迁移的最高优先级。
- **A3 设计已与上游偏离**：当前 fork 选择保持 `--ac`/`--acceptance-criteria` 别名一致性，仅引入 `--clear-ac` 与 MCP `acceptanceCriteriaClear`，具体实现见迁移任务 `BACK-537`。

如需继续生成 **B类** 分析报告或输出 **A类具体迁移任务创建命令**，请告诉我。
