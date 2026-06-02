---
title: Wiki 作为结对执行的知识结晶
labels: [report, wiki-design]
created_date: '2026-05-24 03:00'
updated_date: '2026-05-24 21:15'
---

# Wiki 作为结对执行的知识结晶


> 基于实际使用经验：人类与 AI 头脑风暴 → 沉淀为 doc → AI 拆解为任务 → 结对执行 → 摄取到 wiki 形成项目完整记忆。
> 本文档规划如何让这一流程更顺畅、更系统化。

---

## 一、当前流程画像

```
┌─────────────┐    头脑风暴      ┌─────────────┐    AI 拆解        ┌─────────────┐
│   人类      │ ───────────────→ │  backlog/   │ ───────────────→ │  backlog/   │
│   + AI      │   讨论策略/方案   │    docs/    │   根据 doc       │   tasks/    │
│             │                  │             │   创建任务       │             │
└─────────────┘                  └─────────────┘                  └─────────────┘
                                                                       │
                                                                       │ 结对执行
                                                                       ▼
                                                               ┌─────────────┐
                                                               │  人类审核   │
                                                               │  AI 执行    │
                                                               │  修改任务   │
                                                               └──────┬──────┘
                                                                      │
                                                                      │ 完成
                                                                      ▼
                                                               ┌─────────────┐
                                                               │  backlog/   │
                                                               │   wiki/     │
                                                               │  完整记忆   │
                                                               └─────────────┘
```

### 三层分工

| 层级 | 载体 | 内容 | 所有者 |
|------|------|------|--------|
| **规划层** | `backlog/docs/` | 开发策略、技术方案、需求分析 | 人类主导，AI 辅助 |
| **执行层** | `backlog/tasks/` | 具体任务、验收标准、实现笔记 | AI 创建，人类审核，AI 执行 |
| **记忆层** | `backlog/wiki/` | 知识结晶、模式提取、决策痕迹 | AI 维护，人类审阅 |

### 当前痛点

1. **规划痕迹丢失** — AI 根据 doc 拆解任务时的思考过程没有被记录。为什么选这个拆解方案？考虑了哪些替代方案？这些信息散落在对话中，没有被捕获。

2. **执行知识蒸发** — 任务执行过程中产生的关键知识（技术难点、workaround、意外发现）只存在于任务文件的 Implementation Notes 中，没有被**升华**为可复用的知识。

3. **模式无法复用** — 相似任务反复出现，但 AI 每次都要重新分析。之前的任务执行经验没有被提取为可复用的模式。

4. **跨任务关联隐形** — 多个任务可能解决同一个底层问题，但只能通过人脑记住这种关联。没有显式的语义网络。

5. **微决策流失** — "我用方案 A 而不是 B，因为..." 这类决策只存在于某个任务的备注中，无法被后续任务引用。

---

## 二、设计原则：结对执行的轻量级知识管理

### 2.1 核心隐喻

**不是"企业知识库"，而是"结对笔记本"。**

两个人结对编程时，会在白板或笔记本上随手记录：
- "这个模块的依赖关系太复杂了，下次重构要注意"
- "方案 A 比方案 B 快 3 倍，但内存多用了 20%"
- "测试策略：先写集成测试，再补单元测试"

这些记录是**非正式的、轻量的、随时可查阅的**。wiki 应该扮演同样的角色。

### 2.2 四大原则

| 原则 | 说明 | 反面教材 |
|------|------|----------|
| **非正式** | wiki 记录的是"随手笔记"，不是正式文档 | ❌ 写成长篇 ADR，需要审批流程 |
| **轻量** | 一页一个知识点，不超过 200 行 | ❌ 创建复杂的分类体系和权限控制 |
| **AI 维护** | AI 自动提取和整理，人类只需审阅 | ❌ 要求人类手动维护 wiki |
| **可质疑** | wiki 中的任何内容都可以被修正或删除 | ❌ 一旦写入就不可更改 |

### 2.3 与 Trello/Leangoo 的对比

| 能力 | Trello/Leangoo | Backlog.md 当前 | 增强方向 |
|------|---------------|-----------------|----------|
| **看板** | 拖拽卡片，自定义列 | ✅ TUI + Web 看板 | — |
| **检查清单** | 卡片内 Checklist | ❌ 无 | 用 Markdown task list 替代 |
| **评论** | 卡片评论串 | ❌ 无 | 任务文件内 Comments section |
| **附件** | 文件上传 | ✅ paste/ 目录 | — |
| **标签** | 彩色标签 | ✅ labels | — |
| **成员** | 指派成员 | ✅ assignee | — |
| **截止日期** | Due date | ✅ dueDate | — |
| **过滤** | 多维筛选 | ✅ search | 增强看板列内过滤 |
| **统计** | 燃尽图、累积流 | ❌ 无 | 轻量本地统计（无服务器） |
| **知识沉淀** | 无 | ✅ wiki | **重点增强** |

---

## 三、Wiki 结构增强

在现有 wiki 结构基础上，新增以下目录：

```
backlog/wiki/
├── sources/              # 已有：backlog 源文件摘要
├── concepts/             # 已有：概念文章
├── entities/             # 已有：实体
├── comparisons/          # 已有：对比分析
├── usermanual/           # 已有：用户手册
│
├── patterns/             # NEW：反复出现的任务模式
├── decisions/            # NEW：微决策记录（非正式）
├── reasoning/            # NEW：AI 规划痕迹
├── execution/            # NEW：执行过程中的关键知识
├── retrospectives/       # NEW：轻量回顾记录
│
├── index.md              # 已有：内容目录
├── log.md                # 已有：操作日志
└── overview.md           # 已有：总览
```

### 3.1 `wiki/patterns/` — 任务模式

从已完成的任务中提取**可复用的执行模式**。

**示例：**

```markdown
---
title: "添加新 API 端点的标准模式"
labels: [pattern, api, backend]
created_date: '2026-05-20 10:00'
updated_date: '2026-05-20 10:00'
extracted_from: ["BACK-123", "BACK-145", "BACK-167"]
---

# 添加新 API 端点的标准模式

## 适用场景
需要为已有模块添加新的 REST API 端点。

## 标准步骤
1. **定义接口** — 在 `src/types/api.ts` 添加类型定义
2. **实现路由** — 在 `src/routes/` 添加路由处理器
3. **添加验证** — 在 `src/middleware/validation.ts` 添加输入校验
4. **编写测试** — 在 `src/test/api/` 添加集成测试
5. **更新文档** — 在 `backlog/docs/api-reference.md` 添加接口说明

## 常见陷阱
- 忘记在路由注册文件 `src/routes/index.ts` 中注册新路由
- 输入校验与类型定义不一致（建议用 Zod 统一）
- 测试中没有覆盖错误状态码

## 参考任务
- [[../sources/back-123]] — 用户认证接口
- [[../sources/back-145]] — 任务搜索接口
```

**提取时机：** 当 AI 发现多个任务遵循相似模式时，自动生成 pattern 文件。人类审阅后可以修正或删除。

### 3.2 `wiki/decisions/` — 微决策

记录任务执行过程中产生的**非正式技术决策**。

**与 `backlog/decisions/` 的区别：**

| | `backlog/decisions/` (ADR) | `wiki/decisions/` (微决策) |
|---|---|---|
| **正式程度** | 正式架构决策 | 执行过程中的小决策 |
| **触发条件** | 需要记录重大技术选择 | 任何"为什么选 A 不选 B"的时刻 |
| **内容** | 背景、方案对比、决策、影响 | 一句话决策 + 原因 + 参考任务 |
| **人类参与** | 必须人工创建 | AI 自动提取，人工审阅 |

**示例：**

```markdown
---
title: "使用 Bun.spawn 代替 child_process"
labels: [decision, process-spawning]
created_date: '2026-05-22 14:30'
updated_date: '2026-05-22 14:30'
related_tasks: ["BACK-465"]
---

# 使用 Bun.spawn 代替 child_process

## 决策
在 Windows MCP 修复中，使用 `Bun.spawn` 运行 `isGitRepository` 检查，而不是 Node.js 的 `child_process`。

## 原因
`child_process` 在 Windows 上会继承 MCP stdio 管道，导致 stdin close 误触发挂起。`Bun.spawn` 可以显式设置 `stdin: "ignore"` 避免这个问题。

## 参考
- [[../sources/back-465]] — Windows MCP document tool 挂起修复
```

**提取时机：** AI 在任务执行过程中，发现"选择 A 而不是 B"的场景时，自动生成。

### 3.3 `wiki/reasoning/` — 规划痕迹

记录 AI **根据 doc 拆解任务时的思考过程**。

**为什么重要：**
- 人类可以审阅 AI 的规划逻辑，发现遗漏或偏差
- 后续 AI 可以读取之前的规划痕迹，了解"这个项目通常怎么拆解"
- 当规划需要调整时，人类知道"原来 AI 是这么想的"

**示例：**

```markdown
---
title: "BACK-480 里程碑搜索修复的规划分析"
labels: [reasoning, planning]
created_date: '2026-05-23 09:00'
updated_date: '2026-05-23 09:00'
source_doc: "doc-1"
planned_tasks: ["BACK-480"]
---

# BACK-480 里程碑搜索修复的规划分析

## 原始需求（来自 doc）
修复里程碑页面搜索时模糊匹配误报的问题。

## 分析过程

### 问题定位
1. 首先查看了 `SearchService` 的实现，发现里程碑搜索复用了通用的 Fuse.js 搜索逻辑
2. 通用搜索的匹配阈值较低（0.4），导致 "m1" 匹配 "milestone-1" 时产生误报
3. 里程碑搜索应该使用精确匹配或更高的阈值

### 方案对比
| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| A. 全局提高阈值 | 简单 | 影响其他搜索场景 | ❌ |
| B. 里程碑专用搜索逻辑 | 精确控制 | 代码重复 | ✅ |
| C. 添加搜索类型参数 | 通用 | 改动面大 | ❌ |

### 选择方案 B 的原因
里程碑搜索是特定场景（按名称查找），使用专用逻辑更可控。虽然有一点点代码重复，但后续可以提取为通用工具函数。

## 任务拆解
1. **BACK-480** — 在 `MilestonesPage` 中添加专用搜索过滤逻辑，不使用 `SearchService`
   - 预估工作量：2h
   - 风险：低

## 后续观察
如果其他页面也出现类似误报，应考虑提取一个 `exactMatchSearch` 工具函数。
```

**生成时机：** AI 完成规划后立即生成。人类可以补充、修正或否定其中的分析。

### 3.4 `wiki/execution/` — 执行笔记

记录任务执行过程中产生的**关键知识**。

**与任务文件 Implementation Notes 的区别：**

| | 任务文件 Implementation Notes | wiki/execution/ |
|---|---|---|
| **内容** | 当前任务的实现细节 | 可复用的跨任务知识 |
| **时效性** | 随任务完成而"冻结" | 持续更新和关联 |
| **作用域** | 单个任务 | 多个任务共享 |
| **维护者** | AI 在任务执行时写入 | AI 从任务中提取并升华 |

**示例：**

```markdown
---
title: "React Context + Hook 的零依赖 i18n 实现要点"
labels: [execution, i18n, react]
created_date: '2026-05-18 11:00'
updated_date: '2026-05-20 16:00'
extracted_from: ["BACK-478"]
---

# React Context + Hook 的零依赖 i18n 实现要点

## 核心模式
1. 编译时将翻译字典嵌入二进制（避免运行时加载）
2. 使用 React Context 在根组件注入当前语言
3. 用 Hook 读取当前语言和翻译函数
4. 类型安全：TypeScript 确保所有翻译键都有对应文本

## 关键实现细节
- **编译时嵌入**：通过 `scripts/embed-locales.ts` 将 JSON 翻译文件转换为 TypeScript 对象，直接 import
- **语言切换**：修改 `document.documentElement.lang`，React 自动重新渲染
- **回退机制**：缺失的键显示 `"[missing: keyName]"` 便于调试

## 踩坑记录
- 不要在 Hook 外部调用 `useTranslation()`，会导致 Context 丢失
- 测试时需要包裹 `I18nProvider`，否则翻译函数返回空字符串

## 参考任务
- [[../sources/back-478]] — Web UI i18n 支持
```

**提取时机：** 任务完成后，AI 从任务的 Implementation Notes 中提取可复用知识，写入 wiki。

### 3.5 `wiki/retrospectives/` — 轻量回顾

不是正式的 Sprint Retrospective 会议记录，而是 AI 基于数据自动生成的**轻量回顾**。

**示例：**

```markdown
---
title: "2026-W21 迭代回顾"
labels: [retrospective]
created_date: '2026-05-26 10:00'
updated_date: '2026-05-26 10:00'
period: "2026-05-19 ~ 2026-05-25"
tasks_completed: 8
tasks_created: 10
---

# 2026-W21 迭代回顾

## 数据概览
- 完成任务：8（计划 10，完成率 80%）
- 平均完成时间：3.2 天
- 阻塞任务：2（BACK-474、BACK-475）

## 观察
1. **Wiki 相关任务耗时较长** — BACK-473、BACK-474、BACK-481 都涉及 Wiki 功能，平均耗时 4.5 天，超出平均。原因可能是 Wiki 的架构还在演进中，边界不够清晰。

2. **粘贴功能连锁修复** — BACK-476（HTML 转义修复）是在 BACK-475（docx 上传）完成后发现的边界问题。建议以后在实现文件处理功能时，增加"特殊字符处理"的验收标准。

## 建议
- 为涉及文件解析的功能增加 "special characters / edge cases" 检查清单
- 考虑将 Wiki 相关的通用逻辑提取为独立工具函数
```

**生成时机：** 每周或每完成一批任务后，AI 自动生成。人类可以补充定性观察。

---

## 四、摄取流程增强

### 4.1 当前摄取流程

```
git diff → 检测变更文件 → 读取内容 → 生成 source 摘要
                                              ↓
                                        更新 concept/entity
                                              ↓
                                        更新 index/overview
```

### 4.2 增强后的摄取流程

```
git diff → 检测变更文件
              ↓
    ┌─────────┼─────────┐
    ↓         ↓         ↓
 source/   reasoning/  patterns/
(已有)    (新增)      (新增)
    │         │         │
    └─────────┼─────────┘
              ↓
        模式检测
    ┌─────────┼─────────┬─────────┐
    ↓         ↓         ↓         ↓
decisions/ execution/ retrospectives/ concepts/
(新增)    (新增)      (新增)       (已有)
    │         │         │         │
    └─────────┴─────────┴─────────┘
              ↓
        更新 index/overview
```

### 4.3 触发条件

| 目录 | 触发条件 | 自动化程度 |
|------|----------|------------|
| `sources/` | 源文件变更 | 全自动（已有） |
| `reasoning/` | AI 完成规划后 | 半自动（AI 生成，人类审阅） |
| `patterns/` | 检测到 3+ 相似任务 | 半自动（AI 建议，人类确认） |
| `decisions/` | AI 执行过程中发现方案选择 | 半自动（AI 提取，人类审阅） |
| `execution/` | 任务完成，有 Implementation Notes | 全自动（AI 从任务提取） |
| `retrospectives/` | 每周或每批任务完成 | 半自动（AI 生成数据，人类补充） |

---

## 五、与任务文件的互动

### 5.1 任务文件中的 Wiki 引用

任务文件应该能够**引用** wiki 中的知识：

```markdown
---
id: BACK-500
title: "为看板添加搜索过滤功能"
status: "To Do"
---

## Description
为看板各列添加独立的搜索过滤功能。

## References
- [[wiki/patterns/web-ui-filtering]] — Web UI 筛选功能的实现模式
- [[wiki/decisions/client-side-filtering]] — 为什么选择客户端过滤而非服务端

## Implementation Notes
参考 [[wiki/execution/react-context-i18n]] 中的模式，使用 Context + Hook 管理筛选状态。
```

### 5.2 查看任务时的 Wiki 提示

当人类或 AI 查看一个任务时，Backlog.md 可以提示相关的 wiki 知识：

```
$ backlog task show BACK-500

# BACK-500 - 为看板添加搜索过滤功能

...任务内容...

💡 相关 Wiki 知识：
   • patterns/web-ui-filtering — Web UI 筛选功能的实现模式
   • decisions/client-side-filtering — 为什么选择客户端过滤而非服务端
```

---

## 六、轻量级度量（无服务器）

参考 Trello/Leangoo 的统计能力，但保持本地轻量：

### 6.1 命令行度量

```bash
# 本周完成率
$ backlog metrics --week
本周完成任务：8/10（80%）
平均完成时间：3.2 天
活跃标签：web-ui(5), wiki(3), bugfix(2)

# 看板流速
$ backlog metrics --flow
To Do → In Progress：平均 1.5 天
In Progress → Done：平均 2.8 天
Done → Archived：平均 5.0 天

# 标签分布
$ backlog metrics --labels
web-ui:    ████████████ 40% (12 tasks)
wiki:      ████████ 27% (8 tasks)
bugfix:    ██████ 20% (6 tasks)
docs:      ████ 13% (4 tasks)
```

### 6.2 度量数据来源

- 任务文件的 `created_date`、`updated_date`、`completed_date`
- Git 提交历史（任务文件变更时间）
- 本地计算，无需服务器

### 6.3 AI 辅助分析

AI 可以基于度量数据生成轻量分析，写入 `wiki/retrospectives/`：

```markdown
## AI 观察
1. **Wiki 相关任务耗时较长** — 平均 4.5 天，超出整体平均 3.2 天
2. **建议**：考虑将 Wiki 的通用逻辑提取为独立工具函数
```

---

## 七、实施优先级

### Phase 1：规划痕迹（立即）
- AI 完成规划后，生成 `wiki/reasoning/{task-id}.md`
- 人类可以在任务文件中看到规划摘要的链接

### Phase 2：执行笔记（1-2 周）
- 任务完成后，AI 从 Implementation Notes 提取知识到 `wiki/execution/`
- 任务文件支持 `[[wiki/...]]` 引用语法

### Phase 3：模式提取（2-4 周）
- AI 检测相似任务模式，建议生成 `wiki/patterns/`
- 人类确认或拒绝

### Phase 4：微决策（4-6 周）
- AI 从任务中提取方案选择记录到 `wiki/decisions/`
- 与正式 ADR 互补

### Phase 5：度量与回顾（6-8 周）
- 添加 `backlog metrics` 命令
- 自动生成 `wiki/retrospectives/`

---

## 八、关键设计决策

### 8.1 为什么不用数据库？

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| **SQLite** | 查询快、结构化 | 需要 schema、不易 diff | ❌ |
| **JSON** | 结构化、易解析 | 不易人类阅读 | ❌ |
| **Markdown** | 人类可读、Git 友好、AI 易写 | 查询慢 | ✅ |

### 8.2 为什么 AI 维护？

人类的精力有限，不应该要求人类手动维护 wiki。AI 负责：
- 自动检测可提取的知识
- 生成草稿
- 更新关联

人类只需要：
- 审阅 AI 生成的内容
- 修正错误
- 删除不合适的条目

### 8.3 为什么保留现有结构？

`sources/`、`concepts/`、`entities/` 等已有目录继续存在：
- `sources/` — 记录"发生了什么"
- `concepts/` — 记录"是什么"
- `patterns/` — 记录"怎么做"（新增）
- `reasoning/` — 记录"为什么这么做"（新增）
- `execution/` — 记录"实际怎么做"（新增）

---

## 九、总结

```
┌─────────────────────────────────────────────────────────────────┐
│                         结对执行知识流                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   头脑风暴 → doc → AI 规划 → tasks → 结对执行 → wiki          │
│                                                                  │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│   │ 人类    │    │ AI      │    │ 人类审核 │    │ AI      │   │
│   │ 主导    │    │ 拆解    │    │ AI 执行 │    │ 萃取    │   │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│                                                                  │
│   wiki/reasoning/  ← 记录"为什么这么规划"                      │
│   wiki/execution/  ← 记录"实际学到了什么"                      │
│   wiki/patterns/   ← 记录"下次可以复用什么"                    │
│   wiki/decisions/  ← 记录"为什么选 A 不选 B"                   │
│   wiki/retrospectives/ ← 记录"这段时间的整体观察"              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**最终目标：** 让人类和 AI 的每一次结对执行，都为项目留下可复用的知识结晶。新任务开始时，AI 能读取这些结晶，提供更有价值的协助。人类审阅时，能看到 AI 的思考过程，做出更明智的决策。

![](assets/paste/Backlog从结对执行到知识结晶.png)

![](assets/paste/Backlog从结对执行到知识结晶2.png)