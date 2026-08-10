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

## 5. 通用判断原则

当上游任务涉及以下主题时，优先**参考重写**而非**直接复用**：

1. **日期/时间字段处理**：必须对齐当前分支的 date-only vs date-time 语义、空字符串清除、UTC 转换规则，以及**「存储 UTC、展示本地时区」的显示策略**。
2. **里程碑 CLI/MCP/Web API**：必须保持 `updateMilestone` 与 actual 字段支持。
3. **Web UI 路由与导航**：新增路由需与现有 `/gantt`、统计页面共存，不能互相覆盖。
4. **任务状态驱动逻辑**：任何由任务状态变化触发的副作用（如里程碑 actual 字段自动填充）需与现有级联逻辑兼容。
5. **统计与概览数据流**：新增或修改统计相关接口时，应复用 WebSocket 推送与缓存机制。

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

凡涉及上述领域，在迁移任务的描述和实施计划中都应采用当前分支的演进方向，不应简单恢复上游旧实现。
