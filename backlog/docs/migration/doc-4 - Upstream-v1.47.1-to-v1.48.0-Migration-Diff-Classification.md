---
id: doc-4
title: Upstream v1.47.1 to v1.48.0 Migration Diff Classification
type: guide
created_date: '2026-07-28 06:04'
updated_date: '2026-08-09 16:10'
---
# 上游变更差异分类（v1.47.1 .. v1.48.0）

## 概述

- **上游分支**：`upstream/main`
- **范围**：`v1.47.1 .. v1.48.0`
- **上游仓库**：`MrLesk/Backlog.md`
- **当前工作分支**：`task-529`
- **分析依据**：上游 `v1.48.0` Release Notes + `git log --oneline v1.47.1..v1.48.0` + 当前分支排除清单 `references/current-branch-migration-exclusions.md`
- **导入位置**：`backlog/drafts/`（原始任务已作为 draft 导入；A4/A7/A8/A9 已升级为当前 fork 迁移任务，见下表「原始/迁移任务」列）

 [相对路径](backlog/docs/migration/doc-5 - A类上游任务迁移分析报告.md)

[源代码](src/web/components/MermaidMarkdown.tsx)

 [testing-style-guide](/documentation/001/testing-style-guide)

 [](/documentation/5)

## 分类说明

| 分类 | 含义 | 处理建议 |
|------|------|----------|
| **A类** | 必须合入 | 安全漏洞、关键 bug 修复、当前 fork 已规划但尚未实现的核心功能 |
| **B类** | 评估合入 | 新功能、非核心优化，需用户确认是否与当前 fork 定制冲突 |
| **C类** | 跳过 | 与当前 fork 演进方向冲突、上游特有方向、或当前 fork 无关的改动 |

> 用户可用编号（如 A1、B3、C2）指定需要进一步单任务分析的条目。原始任务文件曾作为 draft 导入到 `backlog/drafts/`；已升级的迁移任务见「原始/迁移任务」列。具体分析后会在「分析报告」列填入对应文档。

---

## A类（必须合入）

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 是否分析 | 原始/迁移任务 | 分析报告 |
|---|---|------|----------|------|----------|----------|----------|
| A2 | **BACK-516 重复任务 ID 检测与修复** | 检测 TASK-1 与 TASK-01 等等价拼写或合并后产生的重复 ID，提供 human-first 的诊断和修复工作流；CLI 对模糊 ID 操作 fail-closed；Web UI 也共享同一修复能力。 | 核心数据完整性修复，避免合并/零填充导致任务静默折叠；当前 fork 无相关实现 | 中 | 是 | [BACK-538](/task/538) | [doc-5 A2](/documentation/5:30-41) |
| A3 | **BACK-537 AC/DoD 确定性编辑** | 保持 `--ac` 与 `--acceptance-criteria` 在 `task edit` 中为累加别名（`task create` 不变），新增 `--clear-ac` 原子清除并拒绝与增量操作混用；共享序列化器保证规范章节顺序、自定义内容、空白稳定性与 CRLF 保留。指南中补充说明：如需整体替换可先 clear 再重新添加，或直接用文本编辑器修改 Markdown。 | 当前 fork 刚增强 `task edit`（BACK-530），CLI 编辑语义应与此对齐；同时保持 `--ac` 与 `--acceptance-criteria` 别名一致性 | 低 | 是 | [BACK-537](/task/537) | [doc-5 A3](/documentation/5:44-55) |
| A4 | **BACK-540 修复 config.yml block-style YAML list** | 修复 `statuses`/`labels`/`types`/`priorities` 等 block-style YAML 列表（如 `- item`）被静默忽略的问题，并修正 `config set` 对列表键的指引。 | 配置解析 bug，可能导致当前 fork 的 `types`/`priorities` 等列表配置失效 | 低 | 是 | [BACK-533](/task/533) | [doc-5 A4](/documentation/5:58-69) |
| A5 | **BACK-533 防止陈旧 ContentStore 刷新覆盖新状态** | 修复 ContentStore 在接收到较旧刷新时覆盖较新状态的问题，保证任务/文档/决策视图总是基于最新数据。 | 数据一致性修复 | 低 | 是 | [BACK-540](/task/540) | [doc-5 A5](/documentation/5:72-83) |
| A7 | **BACK-518 ordinal-only 重排不更新 updated_date** | 仅调整任务 ordinal（排序号）时，不再 bump `updated_date`，避免无意义变更。 | 避免无意义变更污染任务文件 | 低 | 是 | [BACK-534](/task/534) | [doc-5 A7](/documentation/5:86-97) |
| A8 | **BACK-429 保留未保存 Web draft 跨越文件刷新** | Web UI 在文件后台刷新时，保留用户正在编辑但尚未保存的 draft 内容。 | 防止数据丢失 | 低 | 是 | [BACK-535](/task/535) | [doc-5 A8](/documentation/5:100-111) |
| A9 | **BACK-426 修复文档内 markdown hash 链接** | 修复文档内 markdown 中 hash 链接（如 `[link](#heading)`）的解析/渲染问题。 | Web UI bug 修复 | 低 | 是 | [BACK-536](/task/536) | [doc-5 A9](/documentation/5:114-125) |
| A10 | **BACK-240 修复 Apple Silicon 二进制解析** | 修复 Rosetta/arch 不匹配环境下 Apple Silicon 二进制解析失败的问题。 | 兼容性修复 | 低 | 是 | [BACK-550](/task/550) | [doc-5 A10](/documentation/5:128-139) |

> 注：原 **A7（BACK-528 修复 All Tasks ID 排序中子任务顺序）** 已移至 **C11**，原 **A5（BACK-538 修复 macOS 端口探测失效）** 已移至 **C12**，原 **A11（BACK-473 backlog browser 端口冲突处理）** 已移至 **C13**。这三项当前 fork 已包含对应修复能力，无需重复合入。原 **A1（BACK-355 任务类型字段）** 已移至 **C18**，因用户评估单选的 `type` 会边缘化现有 `label` 分类的使用，已决策放弃。

---

## B类（评估合入）

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 是否分析 | 原始/迁移任务 | 分析报告 |
|---|---|------|----------|------|----------|----------|----------|
| B3 | **BACK-532 `--exclude-status` 过滤** | 在 CLI 任务列表/搜索、Web All Tasks 中支持排除一个或多个状态，可与其他过滤器组合；同步扩展 `--status` 支持多选；Web 状态筛选器参考 Label 筛选器（LabelFilterDropdown 模式）实现多选与排除；MCP task list/search 同步实现（与上游移除 MCP 表面的决策相反）。 | 新功能，涉及 CLI/search/Web/TUI/MCP 过滤 | 低 | 可选 | [BACK-548](/task/548) | [doc-6 B3](/documentation/6:58-68) |
| B4 | **BACK-531 看板创建日期排序** | 在看板列菜单中增加按任务创建日期排序的选项。 | 小优化 | 低 | 是 | [BACK-541](/task/541) | [doc-6 B4](/documentation/6:72-82) |
| B5 | **BACK-527 任务列表 ordinal 排序** | 在任务列表视图中支持按 ordinal（排序号）排序。 | 小优化 | 低 | 是 | [BACK-542](/task/542) | [doc-6 B5](/documentation/6:86-96) |
| B6 | **BACK-427 未分配任务过滤** | 在 CLI 和 MCP 的任务列表/搜索中支持过滤未分配任务。 | 小功能 | 低 | 是 | [BACK-551](/task/551) | [doc-6 B6](/documentation/6:100-110) |
| B7 | **BACK-523 `doc view --plain`** | 为 `backlog doc view` 增加 `--plain` 标志，以纯文本形式输出文档内容，便于脚本使用。 | 小功能；涉及 CLI 文档行为，同步参考 `backlog instructions documents` | 低 | 是 | [BACK-552](/task/552) | [doc-6 B7](/documentation/6:114-124) |
| B8 | **BACK-466 隐藏空状态列** | 当配置开启时，看板中不显示没有任何任务的状态列。 | 配置项增强 | 低 | 是 | [BACK-549](/task/549) | [doc-6 B8](/documentation/6:128-139) |
| B10 | **BACK-525 Browser UI 构建现代化** | 将浏览器 UI 构建路径迁移到 Bun-native 全栈构建：`bun-plugin-tailwind` + `Bun.build`，编译后的二进制直接嵌入 React 应用和静态资源；移除已生成的 `style.css` 和 favicon 回退。 | 构建系统大改；当前 fork 也使用 Bun/Tailwind，直接迁移需谨慎，但改动边界清晰、收益明确 | 高 | 是 | [BACK-553](/task/553) | [doc-6 B10](/documentation/6:157-167) |
| B11 | **BACK-529 浏览器标签过滤字母排序** | Web UI 中标签过滤器按字母顺序排序。 | 小优化 | 低 | 可选 | [BACK-546](/task/546) | [doc-6 B11](/documentation/6:171-181) |
| B12 | **BACK-526 里程碑任务列表增加 Created 列** | 在里程碑卡片内的任务列表中增加创建时间列并支持排序。 | 小优化 | 低 | 是 | [BACK-543](/task/543) | [doc-6 B12](/documentation/6:185-195) |
| B13 | **BACK-517 浏览器任务详情显示 AC 序号** | 在 Web UI 任务详情中显示验收标准的编号。 | 小优化 | 低 | 是 | [BACK-544](/task/544) | [doc-6 B13](/documentation/6:199-209) |

> 注：原 **B8（BACK-423 Web UI 文档文件夹分组）** 已移至 **C14**，因当前 fork 已包含该实现（`backlog/tasks/back-423` Done），无需重复评估合入。原 **B2（BACK-530 用户自定义优先级值）** 已移至 **C15**，因评估后总体风险大于收益，不建议迁移。原 **B9（BACK-421 dateFormat 配置统一生效）** 已移至 **C16**，因上游实现建立在 C10（UTC 显示）之上、与当前 fork 本地时区策略冲突且受原生 `datetime-local` 控件约束，用户已决策跳过。原 **B1（BACK-257 任务深度链接）** 已移至 **C17**，因当前 fork 已用统一的 `/task/:id/:title` 路由实现类似能力，上游 `/board/*`、`/tasks/*` 路径会与当前 fork 独立页面路由冲突，用户已决策跳过。

---

## C类（跳过）

| # | 标题 | 描述摘要 | 理由 | 是否分析 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|----------|----------|
| C1 | **BACK-520 移除 sequences 功能** | 从核心、CLI、MCP、TUI、Web 中彻底移除 sequences 任务序列功能。 | 当前 fork 仍保留 `src/core/sequences.ts` 及相关功能；若跟随上游移除，会删除当前 fork 仍在使用的模块，与排除清单「保持当前分支已支持能力」原则冲突 | 否 | [DRAFT#47](/draft/47) | 不适用 |
| C2 | **BACK-519 README 重构成 landing page** | 将 README 重构成以 review-surface 价值主张为中心的 landing page，并引入 Backlog.md manifesto。 | 品牌/文档方向性改动，与当前 fork 的文档策略无关 | 否 | [DRAFT#46](/draft/46) | 不适用 |
| C3 | **BACK-535 测试可靠性项目** | 大规模重构测试：用真实 CLI 表面测试替代模拟、确定性 teardown、可观察同步、拆分测试套件等。 | 上游内部工程改进，不一定匹配当前 fork 的测试基线 | 否 | [DRAFT#61](/draft/61) (父), [DRAFT#62](/draft/62)..[DRAFT#74](/draft/74) (子任务) | 不适用 |
| C4 | **BACK-524 CI 加速与 Windows 超时修复** | 优化 GitHub Actions 测试工作流，修复 Windows 超时问题。 | 上游 CI 特定配置，与当前 fork 无关 | 否 | [DRAFT#50](/draft/50) | 不适用 |
| C5 | **BACK-521 弱本地模型 agent 体验改进** | 改进 agent 工作流指南，使较弱本地模型也能按指引完成实现。 | Agent 指导文档方向，当前 fork 有自己的 `src/guidelines` 体系 | 否 | [DRAFT#48](/draft/48) | 不适用 |
| C6 | **BACK-310 强调阅读详细指南** | 在 workflow overview 中加强强调阅读详细指南。 | 同上，agent 指导方向 | 否 | [DRAFT#21](/draft/21) | 不适用 |
| C7 | **BACK-428 `npx backlog.md` 使用文档** | 增加通过 npx 使用 backlog.md 的说明。 | 文档/分发策略，当前 fork 无关 | 否 | [DRAFT#34](/draft/34) | 不适用 |
| C8 | **BACK-270 反引号 shell 转义文档** | 文档说明如何在任务创建输入中处理字面反引号，避免 shell 命令替换。 | 文档性内容，当前 fork 已有类似处理（BACK-527 / BACK-530） | 否 | [DRAFT#20](/draft/20) | 不适用 |
| C9 | **Docs - issue-first PR process** | 文档说明 issue-first 的 PR 流程。 | 项目治理文档，与当前 fork 无关 | 否 | 无 | 不适用 |
| C10 | **BACK-471 TUI/CLI/MCP 日期统一按 UTC 显示** | 将 TUI、CLI `--plain`、MCP 输出中的日期统一按 UTC 显示，而非本地时区。 | 与当前 fork 日期显示策略冲突：当前 fork 采用「存储 UTC、展示本地时区」策略（`formatStoredUtcDateForDisplay` 使用 `toLocaleString`/`toLocaleDateString`），不应改为 UTC 显示 | 否 | [DRAFT#37](/draft/37) | 不适用 |
| C11 | **BACK-528 修复 All Tasks ID 排序中子任务顺序**（原 A7） | 修复 "All Tasks" 按 ID 排序时子任务与父任务排序不一致的问题。 | 当前 fork 已包含该修复，无需重复合入 | 否 | [DRAFT#54](/draft/54) | 不适用 |
| C12 | **BACK-538 修复 macOS 端口探测失效**（原 A5） | 修复 `backlog browser` 端口可用性探测在 macOS 上实际为空操作的问题，使端口冲突回退逻辑真正生效。 | 当前 fork 已使用 `get-port` 实现端口探测与回退，已包含该修复能力 | 否 | [DRAFT#77](/draft/77) | 不适用 |
| C13 | **BACK-473 backlog browser 端口冲突处理**（原 A11） | 当 `backlog browser` 目标端口被占用时，自动寻找下一个可用端口，而不是直接失败。 | 当前 fork 已实现 `autoPort` 端口回退（见 `src/server/index.ts` 与 `src/test/server-port.test.ts`），无需重复合入 | 否 | [DRAFT#38](/draft/38) | 不适用 |
| C14 | **BACK-423 Web UI 文档文件夹分组**（原 B8） | 在 Web UI 文档视图中按子目录对文档进行分组展示。 | 当前 fork 已包含该实现（`backlog/tasks/back-423` Done），无需重复评估合入 | 否 | [DRAFT#31](/draft/31) | 不适用 |
| C15 | **BACK-530 用户自定义优先级值**（原 B2） | 允许项目通过配置定义自己的优先级列表（如 Very High / High / Medium / Low / Very Low），不再限定为 high/medium/low；CLI、MCP、Web、统计均支持。 | 评估后判定总体风险大于收益：改动面横跨 core 校验、CLI、MCP、server 过滤、Web 编辑/过滤/排序/统计、i18n 翻译边界与类型系统，需放开字面量联合类型并动态化颜色/排序/过滤三套逻辑，易遗漏导致自定义优先级"存得进、筛不出"或显示/排序静默退化；当前 fork 三档已满足绝大多数场景 | 是 | [DRAFT#56](/draft/56) | [doc-6 B2](/documentation/6:44-54) |
| C16 | **BACK-421 `dateFormat` 配置统一生效**（原 B9） | 使 `dateFormat` 配置在 TUI、Web UI、CLI 展示中统一生效；仅影响显示，不改变 UTC 存储格式。 | 上游 B9 建立在 C10（BACK-471 UTC 显示）之上，照搬会破坏当前 fork 本地时区显示契约；且 `actualStart`/`actualEnd` 的 Web 编辑框是原生 `datetime-local`（HTML 规范强制 ISO value），dateFormat 无法作用其上，仅改只读显示会造成显示/编辑格式割裂。用户已决策跳过（2026-08-09） | 否 | [DRAFT#30](/draft/30) | [doc-6 B9](/documentation/6:143-153) |
| C17 | **BACK-257 任务深度链接**（原 B1） | 为看板和任务列表添加可分享的 deep link：`/board/123/title` 和 `/tasks/123/title`，打开后自动弹出对应任务；关闭弹窗恢复 URL；保留 legacy `?highlight=task-123` 兼容。 | 当前 fork 已实现独立的 `/task/:id/:title` 和 `/draft/:id/:title` 路由（`src/web/App.tsx`），点击任务导航到 URL 并打开弹窗，Back/Close 恢复 URL，功能已被覆盖；上游 `/board/*`、`/tasks/*` 路径与当前 fork 的独立页面路由冲突。用户已决策跳过（2026-08-09） | 否 | [DRAFT#17](/draft/17) | [doc-6 B1](/documentation/6:30-40) |
| C18 | **BACK-355 任务类型字段**（原 A1） | 为任务新增互斥的 `type` 字段（bug/feature/enhancement/task/chore/docs/spike），支持项目级配置，端到端覆盖 core 模型、持久化、CLI、MCP、TUI 看板/详情、Web UI 卡片/详情及过滤。与 labels 不同，type 是单选的。 | 用户评估后判定该功能看似锦上添花，实则会边缘化 `label` 的使用（单选的 `type` 会与现有的多选 `label` 语义重叠、分散用户对 label 的分类依赖）。当前 fork 已用 label 承担分类职责。用户已决策放弃（2026-08-09） | 否 | [DRAFT#80](/draft/80) (父), [DRAFT#22](/draft/22)..[DRAFT#27](/draft/27) (子任务) | [doc-5 A1](/documentation/5:16-27) |

---

## 建议

- **优先处理 A类**：尤其是 A2（BACK-516，数据完整性）、A3（BACK-537，CLI 编辑语义对齐）、A4（BACK-540，配置解析 bug）。原 **A1（BACK-355 任务类型字段）已移至 C18 放弃**：用户评估单选的 `type` 会边缘化现有 `label` 分类的使用，当前 fork 已用 label 承担分类职责，不迁移。
- **B类中 B10 构建现代化已升级为 [BACK-553](/task/553)**：BACK-525 构建系统改动大（CI/release/Nix/预提交/asset 嵌入），需谨慎执行；改动边界清晰（scripts/build.ts + index.html + server favicon + build.test.ts），风险可控，单独立项推进。**B2（BACK-530 用户自定义优先级值）评估后判定总体风险大于收益，已移至 C15 跳过**；若未来确需可单独立项承接。
- **B1（BACK-257 任务深度链接）已移至 C17 跳过**：当前 fork 已用统一的 `/task/:id/:title` 和 `/draft/:id/:title` 路由实现类似能力，上游 `/board/*`、`/tasks/*` 路径会与当前 fork 独立页面路由冲突。用户已决策跳过。
- **B9（BACK-421 dateFormat 配置统一生效）已移至 C16 跳过**：上游实现建立在 C10（UTC 显示）之上，与当前 fork 本地时区显示策略根本冲突；且原生 `datetime-local` 编辑框无法应用 dateFormat，仅改只读显示会造成显示/编辑格式割裂。`dateFormat` 保持"配置存在但不生效"现状。
- **C类中 C1 需谨慎**：若当前 fork 未来也想移除 sequences，可单独立项，不应作为 v1.48.0 迁移的一部分。
- **C10 为策略冲突**：当前 fork 的日期显示策略是本地时区，上游的 UTC 显示应跳过，而非迁移。
- 迁移实施时，若涉及 CLI 文档行为变更（如 B7），应参考 `backlog instructions documents` 并保持指南同步更新。
