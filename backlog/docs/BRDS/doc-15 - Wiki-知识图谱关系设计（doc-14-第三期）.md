---
id: doc-15
title: Wiki 知识图谱关系设计（doc-14 第三期）
type: specification
created_date: '2026-09-26 02:19'
updated_date: '2026-09-26 09:21'
tags:
  - wiki
  - graph
  - obsidian
  - knowledge-management
  - phase-3
---
# Wiki 知识图谱关系设计

## 决策

使用**项目相对文件路径作为 Wiki 图谱节点的唯一身份**。不引入另一套合成的 Wiki 页面标识。

**本期范围（重要调整）**：只落地四类图谱事实——文件节点（`FileNode` + frontmatter `file_type`）、标签边（`TaggedWith`，来自 `labels`）、溯源边（`SourcedFrom`，来自 `source_path`）、链接边（`LinksTo`，来自正文 `[[wikilink]]` 机械解析）。**语义关系整体暂缓**：`relations` 字段、全部语义边表（`LinksTo`/`Supports`/`Mentions`/`Supersedes`/`ContentDependsOn`/`DerivedFrom`/`Contradicts`/`ReusableFor`）、语义核定流程均保留设计但不实施——当前系统没有任何文件使用 `relations`，也没有消费语义边的查询。等出现真实需求（如决策影响分析、模式复用检索）再启用，启用时设计照旧有效。

图谱是 Markdown 文件和 frontmatter 的投影，不引入独立图数据库，也不建立第二套事实来源。设计必须保持 Obsidian 的原生体验：文件就是节点，Wikilink 是导航入口，正式图谱关系只从 frontmatter 获取。

## 目标

- 保留 Obsidian 的“文件为节点、Wikilink 为边”模型。
- 明确记录来源溯源和文件改名关系。
- 增加语义关系，但不把普通 Wikilink 过度解释成语义关系。
- 将标签作为正交分类维度，而不是节点身份。
- 同时服务人类浏览、Agent 检索和后续自动化检查。

## 非目标

- 用图数据库替换 Markdown。
- 把文件夹归属或 `index.md` 条目自动当成语义关系。
- 把未链接提及自动提升为可信关系。
- 在来源路径无法解析时猜测原始文件。

## 与 doc-14 的关系：第三期扩展设计

本文是 `doc-014` 第 6 节所述第三期的详细设计。第三期不是另起一套图谱，而是在现有任务图谱上扩展知识文件来源：

- 一期继续负责 `backlog/tasks/`、`backlog/drafts/`、`backlog/milestones/`、`backlog/completed/`。
- 二期继续负责跨进程 IPC、批量导入和性能优化。
- 三期新增 `backlog/wiki/`、`backlog/docs/`、`backlog/decisions/` 的文件节点（复用 `FileNode` 表，扩展 `type` 取值）、标签节点和链接边。
- Markdown 文件仍然是唯一事实源，`graph.kuzu` 仍然只是可删除、可重建的派生缓存。
- Graph Service、文件指纹、主动通知、`Bun.watch` 监听、IPC 和 fail-closed 原则保持不变。
- 三期只扩展白名单、`FileNode.type` 取值、解析器和关系表，不改变前两期的任务图谱语义。

## KuzuDB 接入边界

### 文件节点

三期把 `backlog/wiki/`、`backlog/decisions/`、`backlog/docs/` 下的 Markdown 文件导入一期的 `FileNode` 表——同一节点表，三期只扩展 `type` 取值。节点的唯一主键是规范化的项目相对文件路径（doc-014 已将一期节点表从 `Task(id)` 改为 `FileNode(path)`，三期直接复用，不另立 `ContentNode` 表）：

```text
FileNode {       // 三期新增取值后
  path,          // PRIMARY KEY，例如 backlog/wiki/concepts/wiki-lint.md
  id,            // NULL——知识文件没有任务 ID
  type,          // task | draft | milestone（工作文件）| wiki | decision | document（知识文件，取自 file_type）
  title,
  status,        // NULL——知识文件没有工作流状态
  updatedDate
}
```

三期写入的节点只有 `path`、`type`、`title`、`updatedDate` 四个非空字段；`id` 与 `status` 仅任务类文件使用。不存 `contentHash`——指纹哈希只存在旁车文件 `graph.kuzu.meta.json` 的 per-file 缓存里（见 doc-014 §2.1），节点表不重复存。

知识节点的类型写在 frontmatter 的 `file_type` 字段，只能取 `wiki`、`decision`、`document`：

- `backlog/wiki/` 下的所有 Markdown 文件统一是 `file_type: wiki`。`wiki/` 下的子目录（`sources/`、`concepts/`、`decisions/`、`usermanual/` 等，含未来新增的目录）只是文件分类和导航范围，**不定义、也不改变节点类型**。
- `backlog/decisions/` 下的文件是 `file_type: decision`。
- `backlog/docs/` 下的文件是 `file_type: document`。

**为什么不复用 `type`**：`backlog/docs/*.md` 的 `type` 已被 Backlog 自身的文档类型占用（受控值 `readme`/`guide`/`specification`/`other`，见 `src/core/backlog.ts` 的 `normalizeDocumentTypeInput`，非法值直接报错），与 `wiki`/`decision`/`document` 的值域不相交。同一字段无法同时承载两种含义，图谱因此另立 `file_type`，`type` 保持 Backlog 语义不变（存储层的列名仍是 `FileNode.type`，它承载的是这里定义的节点类型）。

目录只负责确定扫描白名单和文件迁移范围（`wiki/index.md` 是导航目录、`wiki/log.md` 是操作日志，两者都不入图），绝不作为运行时节点类型。运行时不得根据文件夹猜测类型：缺少或非法 `file_type` 的文件仍进入图谱，但节点类型为空并记入校验报告，不会被推断成目录对应的类型。`wiki/decisions/` 中的文件仍然是 `wiki` 节点，不会因为目录名而变成 `decision` 节点。

不另造页面标识。文件移动就是节点路径变化；同步引擎删除旧路径节点、加入新路径节点，并重建相关关系。任务文件由 doc-014 的 `id -> path` 解析提供来源定位，三期不需要额外机制。

### 标签节点

当前 Wiki 文件已经使用 frontmatter 的 `labels` 字段。Obsidian 将这类信息称为 tag，但本三期以项目现有的 `labels` 为唯一来源，不新增并行的 `tags` 字段。

标签单独建成虚拟辅助节点：

```text
Tag {
  name           // PRIMARY KEY，例如 topic/source-path
}
```

页面和标签之间建立 `TaggedWith` 关系。`labels` 中的 `concept`、`source`、`decision` 等值是分类标签，不是节点类型；不能从标签反推 `type`。

### 关系表

**本期只建三张关系表**，端点都是一期的 `FileNode` 表：

| 关系表 | 起点 | 终点 | 来源 | 说明 |
|---|---|---|---|---|
| `TaggedWith` | FileNode | Tag | frontmatter `labels` | 当前标签归属 |
| `SourcedFrom` | FileNode | FileNode | frontmatter `source_path` | 知识页面/文档的原始来源，终点可以是任务文件（按 `id` 或 `path` 解析）或知识文件 |
| `LinksTo` | FileNode | FileNode | 正文 `[[wikilink]]` | 页面之间的普通引用，机械解析生成 |

**暂缓实施**（设计保留，本期不建表、不解析）：

| 关系表 | 起点 | 终点 | 说明 |
|---|---|---|---|
| `Supports` | FileNode | FileNode | 来源支持决策或结论 |
| `Mentions` | FileNode | FileNode | 来源明确提到某个概念或实体 |
| `Supersedes` | FileNode | FileNode | 新决策/新页面取代旧页面 |
| `ContentDependsOn` | FileNode | FileNode | 知识之间的前置关系 |
| `DerivedFrom` | FileNode | FileNode | 模式、经验或推理的来源 |
| `Contradicts` | FileNode | FileNode | 页面结论冲突 |
| `ReusableFor` | FileNode | FileNode | 模式的应用范围，终点可以是任务页面或知识页面 |

任务依赖沿用一期的 `DependsOn` 表，不动。以上暂缓表待语义关系启用时再建。

**边属性（暂缓，随语义关系一并实施）**：`relations` 的 `evidence` 列表必须随边入库，不能只留在校验报告里。用 `STRING[]`（已在本项目依赖的 Kuzu 版本实测可建表）：

```cypher
CREATE REL TABLE IF NOT EXISTS Supports(FROM FileNode TO FileNode, evidence STRING[]);
-- 其余语义边表同理：evidence STRING[]，缺省为 []；不支持 JSON 字符串存储
```

**文件改名不进图谱（本期即生效）**：文件移动/改名由同步引擎删旧节点建新节点处理（见 doc-014 §3.5），图谱不保留改名历史边——改名轨迹由 git 历史承担，必要时在旧路径留 Obsidian 重定向页（§2.1）。目标中"文件改名关系"指同步正确性，不是图中的一类边。

所有关系都必须来自 frontmatter；正文 Wikilink 只用于 Obsidian 导航。延续 doc-14 §1.2"按业务语义拆边表"的原则，每种语义关系一张独立关系表，**不使用带 `relationType` 属性的统一大宽表**——宽表会失去端点约束和类型检查，也无法与一期的三张边表保持一致。绝不能把未声明的语义关系伪装成普通 `LinksTo`。

关系表名为 PascalCase，对应 frontmatter `relations.type` 的 snake_case 值（如 `ContentDependsOn` 表 ← `type: depends_on`）。

### 解析器注册

三期按白名单注册解析器，但解析器只读取文件中的显式 `file_type`（本期不解析 `relations`，见到该字段直接忽略，不报错）：


```text
backlog/wiki/       -> FileNode.file_type = "wiki"
backlog/decisions/  -> FileNode.file_type = "decision"
backlog/docs/       -> FileNode.file_type = "document"
```

目录白名单决定“哪些文件进入图谱”；frontmatter `file_type` 决定“进入图谱后是什么节点”。两者必须分别校验。解析器版本必须进入现有汇总指纹。目录、解析器或关系规则变化时递增 parser version，即使 Markdown 没有变化也触发重建。`graph.kuzu` 的冷启动和热更新流程不另起炉灶。

### 来源解析

`source_path` 是 `SourcedFrom` 边的定位属性，两种解析方式都落在统一的 `FileNode` 表上：

1. 先按规范化路径匹配 `FileNode` 节点（`path` 主键）。
2. 路径失效时，按稳定来源标识在白名单目录中寻找唯一候选（任务来源用任务 ID，如 `back-712`，走 `id` 属性索引；知识来源用规范化路径）。
3. 找到唯一候选就更新 `source_path` 并重建边。
4. 多个候选或没有候选时不建边，写入 `invalidRelations` / `unresolvedSources` 报告。
5. 原始来源确认删除时保留知识页面，记录来源已不存在。

`source_path` 是文件路径；任务来源走 `id` 属性匹配，知识来源走 `path` 主键匹配。三期迁移时给 `FileNode.id` 建索引（doc-014 §1.2 的 `id -> path` 映射即以此为基础）。

三期沿用 doc-14 的 fail-closed 规则：解析失败不能静默丢弃节点或边，也不能让图谱继续假装关系有效。

## 关系来源：只读取文件，不推断语义

本期图谱关系全部机械来自文件内容（frontmatter 字段 + 正文 Wikilink），不做任何语义推断。对当前 Wiki 文件的实测结果：`labels` 和 `source_path` 已被广泛使用（绝大多数 Source 页面都有 `source_path`），`type` 只有个别文件声明，`relations` 目前**没有任何文件使用**——语义关系全部是从零起步的目标状态，三期解析器对缺失 `relations` 的文件视为"没有语义边"，而不是报错。三期本期读取 `type`、`labels`、`source_path` 和正文 `[[wikilink]]`，全部机械解析。解析器不能通过语义推断补造关系：正文 Wikilink 只生成 `LinksTo` 普通引用边，语义含义一律不推断；语义关系（`relations`）启用前，图谱中不存在任何语义边。

### 可进入图谱的 Frontmatter 字段

| 来源 | 用途 |
|---|---|
| frontmatter `file_type` | 内容节点类型，只能是 `wiki`、`decision`、`document`（不复用 `type`，见 §2.2） |
| frontmatter `labels` | `TaggedWith` 标签边 |
| frontmatter `source_path` | `SourcedFrom` 溯源边 |
| 正文 `[[wikilink]]` | `LinksTo` 链接边（机械解析，见下） |
| frontmatter `relations` | 显式语义边（**暂缓**，本期不读取） |
| 文件路径 | 节点身份和文件迁移关系 |

`[[wikilink]]` 的解析规则：不带 `.md` 后缀、相对 `backlog/wiki/` 根解析（如 `[[concepts/wiki-lint]]` → `backlog/wiki/concepts/wiki-lint.md`）；支持 Obsidian 的 `[[path\|alias]]` 别名形式，只取 `path` 部分。目标解析不出唯一文件时不建边，记入 `invalidRelations`——fail-closed，不猜。

### Frontmatter 语义关系（暂缓，启用时生效）

所有语义关系必须显式写入 `relations`：

```yaml
relations:
  - type: supports
    target: backlog/wiki/decisions/source-path-validation.md
    evidence:
      - backlog/docs/source-path-review.md
```

每条关系至少需要：

- `type`：关系类型
- `target`：项目相对文件路径
- `evidence`：可选的证据文件路径列表

`target` 无法唯一解析时不建边，并记录 `invalidRelations`。关系不能只依靠标题、目录、标签、正文关键词、未链接提及或 Agent 的自然语言判断生成。

### 正文 Wikilink 的边界

正文中的 `[[wikilink]]` 继续作为 Obsidian 导航链接，**同时机械生成 `LinksTo` 正式图谱边**（本期实施）。但这只是"页面 A 引用了页面 B"的引用事实，不带任何语义：如果某条 Wikilink 需要表达 `supports`、`depends_on`、`contradicts` 等语义，必须在语义关系启用后写入 frontmatter 的 `relations` 声明。`LinksTo` 是引用边，不是语义边。

### Agent 的行为边界：两级核定

关系进入图谱前必须经过两级核定，Agent 在两级中的角色不同：

**第一级：形式核定（自动化，工具执行）**

每条候选关系写入前必须通过机械校验，不依赖任何模型判断，可直接做成 lint/写入前检查：

- `type` 是受控值（`links_to`/`supports`/`depends_on`/`contradicts`/`supersedes`/`mentions`/`derived_from`/`reusable_for`）；
- `target` 是完整的项目相对路径，文件存在且唯一解析；
- `target` 在白名单范围内（`backlog/wiki/` 或显式允许的原始来源目录）；
- 如带 `evidence`，每个证据路径也存在且可解析。

形式核定不通过 → 拒绝写入并报告。这一步**不许大模型放行**。

**第二级：语义核定（判断"这条关系是否属实"）**

> 本节随语义关系整体暂缓，启用时以下规则照旧有效。

默认由**人工**执行：Agent 只能从内容中识别"可能存在关系"，作为待审建议附证据引用列出，由人确认后才写入 frontmatter。只有经过确认写入的关系才成为图谱事实，未确认的推断不得进入 `graph.kuzu`。

例外：如果项目方明确授权大模型承担语义核定，必须满足两个约束，否则仍视为未核定：

1. **核定者与提出者分离**——做语义核定的模型/pass 与提出关系的模型/pass 不是同一次调用（自己给自己的推断盖章等于没核定）；
2. **逐条可举证**——每个通过核定的关系必须列出正文/来源中的具体证据位置（文件 + 段落），无法举证的降级为待审建议。

形式核定可以也完全应该由工具自动跑；语义核定是"推断"与"事实"之间的闸门，这道闸门要么是人，要么是满足上面两条的独立核定 pass。

### Kuzu 同步规则

本期同步规则：

- 冷启动和热更新只读取文件系统中已经存在的内容（frontmatter 字段 + 正文 Wikilink）。
- `labels` 机械生成 `TaggedWith` 边，`source_path` 机械生成 `SourcedFrom` 边，正文 `[[wikilink]]` 机械生成 `LinksTo` 边。
- 溯源/链接目标缺失、格式错误或存在歧义时不建边，报告错误并保持 fail-closed。
- 边来源和目标必须随校验报告保留，不能只保留一条无法解释的边。

暂缓：`relations` 按显式声明生成语义边；语义边的证据（`evidence`）随校验报告保留。

这套规则把“文件事实”和“Agent 推断”严格分开：图谱可以自动同步 frontmatter 中已经声明的事实，但不会把推断伪装成项目关系。

## 1. Obsidian 模型映射

| Obsidian 概念 | Wiki 图谱中的含义 |
|---|---|
| Markdown 文件 | 由规范化项目相对路径标识的节点 |
| 正文 `[[wikilink]]` | Obsidian 导航链接；机械生成 `LinksTo` 引用边（本期） |
| Backlink | Obsidian 正文导航的反向链接，不自动成为图谱边 |
| Frontmatter 属性 | 节点元数据 |
| Tag | 虚拟 `Tag` 节点 + `TaggedWith` 边，或正交分类维度 |
| Unlinked mention | 不进入正式图谱 |
| 文件夹 | 分类和过滤维度，不是语义关系 |
| `index.md` | 人类导航目录，不是图谱事实来源 |

正文中的 Wikilink 不带 `.md` 后缀：

```markdown
[[concepts/wiki-lint]]
```

解析后对应的规范节点路径为：

```text
backlog/wiki/concepts/wiki-lint.md
```

## 2. 节点模型

### 2.1 文件路径规则

节点的唯一身份是规范化的项目相对文件路径：

```text
backlog/wiki/concepts/wiki-lint.md
backlog/wiki/sources/back-712.md
backlog/wiki/decisions/source-path-validation.md
```

路径规范：

- 图谱数据和 frontmatter 统一使用 `/`。
- 路径相对于项目根目录，不写入机器绝对路径。
- 保留实际文件名中的空格和标点。
- 比较前清理 `.` 和重复分隔符。
- 不从标题、slug 或显示名称推导节点身份。

移动 Wiki 页面会改变节点身份。移动页面时必须在同一操作中更新所有指向旧路径的关系。如果外部链接需要继续有效，可以在旧路径保留一个小型重定向页，而不是引入第二套身份机制。

### 2.2 节点类型

三期只定义三种内容节点类型：

| `type` | 文件范围 | 说明 |
|---|---|---|
| `wiki` | `backlog/wiki/**/*.md` | 当前 Wiki 的全部页面；子目录不改变节点类型 |
| `decision` | `backlog/decisions/**/*.md` | Backlog 原始决策记录 |
| `document` | `backlog/docs/**/*.md` | Backlog 文档和设计文档 |

`backlog/wiki/sources/`、`backlog/wiki/concepts/`、`backlog/wiki/decisions/` 等目录只是文件分类和导航范围，不是节点类型。比如：

```text
backlog/wiki/decisions/doctor-human-first-fail-closed-repair.md -> type: wiki
backlog/decisions/decision-1 - Use-Tailwind-CSS-v4-for-web-UI-development.md -> type: decision
backlog/docs/BRDS/doc-014 - Kuzu-任务图谱：冷启动校验与热更新设计.md -> type: document
```

`Tag` 是辅助虚拟节点，不是第四种内容节点类型。`labels` 中的 `concept`、`source`、`decision` 等值也不改变节点的 `type`。

每个进入三期图谱的文件都必须在 frontmatter 中显式声明 `file_type: wiki|decision|document`。缺少或非法 `file_type` 时报告校验错误，节点仍入图但类型为空；解析器不从文件夹、文件名、标题或标签推断类型。

### 2.3 原始来源节点

原始文件作为外部溯源节点，不要求额外创建重复的 Markdown 文件：

```text
backlog/tasks/back-712 - Agents-miss-source_path-problems-during-wiki-lint-reviews.md
backlog/docs/doc-6 - Tracking-Gantt-Design.md
src/file-system/operations.ts
```

Source 页面通过溯源关系指向原始文件。物理位置记录在 `source_path`，每次检查都必须确认该路径在文件系统中真实存在。

## 3. 关系模型

### 3.1 Frontmatter 关系

本期图谱关系从 Wiki 文件的字段和正文机械生成：

- 知识文件的 `labels` 生成 `TaggedWith` 边（只限 `wiki/`、`decisions/`、`docs/` 三类，见 §4）。
- `source_path` 生成 `SourcedFrom` 溯源边。
- 正文 `[[wikilink]]` 生成 `LinksTo` 引用边。
- 文件路径提供节点身份和文件迁移依据。

语义关系（`relations`，暂缓）启用后才加入第 4 类来源。`LinksTo` 只是"引用了"这一事实，语义仍须显式声明。

### 3.2 溯源关系

每个带 `source_path` 的 Wiki 页面都必须有一条可验证的溯源关系：

```text
backlog/wiki/sources/back-712.md
    --sourced_from-->
backlog/tasks/back-712 - Agents-miss-source_path-problems-during-wiki-lint-reviews.md
```

Source 页面在 frontmatter 中保存关系定位信息：

```yaml
source_path: backlog/tasks/back-712 - Agents-miss-source_path-problems-during-wiki-lint-reviews.md
```

`source_path` 是当前位置，不是 Wiki 页面身份。原始文件改名时更新路径，Wiki 页面文件路径保持不变。

### 3.3 语义关系（暂缓）

所有语义关系必须写入 frontmatter 的 `relations`，正文 Wikilink 只负责导航。本期不解析、不建边，以下为启用时的规范：

```yaml
relations:
  - type: depends_on
    target: backlog/wiki/concepts/source-provenance.md
  - type: supports
    target: backlog/wiki/decisions/source-path-validation.md
```

`target` 使用完整的项目相对文件路径，包括 `.md` 后缀。

推荐的关系类型：

| 关系 | 含义 |
|---|---|
| `links_to` | 页面之间的普通引用（与正文 Wikilink 不同，必须是显式声明） |
| `sourced_from` | Wiki source 页面由哪个原始文件编译而来（通常不必手写，`source_path` 机械生成） |
| `mentions` | 来源明确提到某个概念或实体 |
| `depends_on` | 概念、决策或模式存在前置依赖（入 `ContentDependsOn` 表，与一期任务依赖 `DependsOn` 分表） |
| `supports` | 来源为某个决策提供证据 |
| `supersedes` | 新决策取代旧决策 |
| `contradicts` | 两个页面存在不兼容结论 |
| `derived_from` | 执行经验、推理或模式来自哪个来源 |
| `reusable_for` | 模式可以应用到哪些任务、来源或执行页面 |

正文导航不自动生成语义边；`mentions` 和其他语义关系必须通过 frontmatter 的 `relations` 明确写出并可审查。

## 4. 标签设计（当前 `labels`）

当前 Wiki 文件已经使用 frontmatter 的 `labels` 字段，例如 `labels: [concept]`、`labels: [source, bug, wiki]`。Obsidian 将标签称为 tag，但三期以项目现有字段为准：图谱解析器读取 `labels`，不新增并行的 `tags` 字段。

`labels` 用于回答“属于哪个领域”“讨论什么主题”“来源是什么”“当前处于什么状态”等分类问题。`labels` 不替代文件路径、`type`、`source_path` 或 `relations`，也不能反推出节点类型。

**只有知识文件的 `labels` 进入图谱。** 任务、草稿、里程碑同样有 `labels` 字段，但那是 Backlog 的任务分类（`bug`、`critical`、`tdd`、`docker`…），与知识层的受控词汇不是同一套。两者若共用一个 `Tag` 表：任务标签会混进知识图谱的图例与计数；而在只看知识类型的视图里，隐藏工作文件后，只被任务使用的标签会失去全部载体，变成没有任何边、却仍被画出来的孤立 Tag 节点（本仓实测：216 个 Tag 中有 79 个属于这种情况）。图谱因此只把三类知识文件的 `labels` 解析为 `TaggedWith`——收窄后本仓 137 个 Tag 全部有 wiki 页面承载，孤立数为 0。

配套的视图规则：Tag 是虚拟节点，只通过 `TaggedWith` 存在。若某次阅读把它的载体全部隐藏（例如用户在知识图谱里关掉「Wiki 页面」），该 Tag 也随之从图中剔除，而不是留下一个无边的点。

### 4.1 标签命名空间

新写入的标签统一使用小写 kebab-case，并带命名空间前缀；现有标签可以先保留，后续按受控词汇逐步规范化。注意当前文件中的 `labels` 全部是**无命名空间的自由值**（如 `concept`、`source`、`bug`、`wiki`、`cli`、`web-ui`），下表是受控词汇的目标约定，不是现状：

| 命名空间 | 示例 | 含义 |
|---|---|---|
| `domain/` | `domain/wiki`、`domain/cli`、`domain/web-ui` | 产品或系统领域 |
| `topic/` | `topic/source-path`、`topic/linting`、`topic/wikilink` | 稳定主题 |
| `origin/` | `origin/task`、`origin/decision`、`origin/source-code` | 产生知识的原始材料类型 |
| `lifecycle/` | `lifecycle/active`、`lifecycle/deprecated`、`lifecycle/unresolved` | 维护状态 |

不要为任务 ID、日期或一次性实现细节创建标签。这些信息应放在 `source_path`、日期字段或其他专用字段中。

### 4.2 标签归属规则

- `wiki` 页面使用描述其领域的 `domain/` 和主题的 `topic/` 标签。
- `decision` 页面使用该决策的 `topic/` 和相关 `domain/`，不使用所有提及它的任务 ID。
- `document` 页面使用文档覆盖的 `domain/` 和 `topic/` 标签。
- 只有可复用的分类才创建标签，不为原文中的每个名词创建标签。
- 标签是受控词汇；不能无映射地同时创建 `wiki`、`knowledge-base`、`wiki-system` 等同义标签。
- `labels` 中的历史值（例如 `concept`、`source`）继续作为标签保存，但不被解释为 `type`。

### 4.3 Frontmatter 示例

```yaml
---
title: Wiki source path provenance
file_type: wiki
labels:
  - domain/wiki
  - topic/source-path
  - topic/data-provenance
  - lifecycle/active
# relations 暂缓：启用后按此格式声明语义关系
# relations:
#   - type: depends_on
#     target: backlog/wiki/concepts/task-identity.md
---
```

当前文件不要求同时写 `labels` 和 `tags`。如果未来决定迁移到 Obsidian 的 `tags` 字段，必须作为一次明确的数据迁移完成，不能让两个字段长期成为互相冲突的来源。

## 5. 基于路径的来源解析

来源解析按以下顺序执行：

1. `source_path` 存在且指向预期原始来源时，保持不变。
2. `source_path` 不存在时，在原始来源目录中按稳定来源标识搜索，例如 `back-712`、`doc-6` 或源代码路径。
3. 恰好找到一个候选时，更新 `source_path`，Wiki 页面文件路径不变。
4. 找到多个候选时，标记为歧义并请求用户决定。
5. 找不到候选时，报告未解析的溯源关系，但保留 Wiki 页面。
6. 确认原始文件确实被删除时，在 Source 页面正文记录来源已不存在；不得编造替代路径。

该策略可以在原始文件改名后恢复定位，同时保持 Wiki 页面节点和摘要内容不变。

## 6. 图谱示例

以下示例中，溯源/标签/引用示例（`sourced_from`、`tagged_with`、`links_to`）属本期范围——其中 `links_to` 由正文 `[[wikilink]]` 机械生成，不需要手写；语义示例（`supports`、`depends_on`、`derived_from`、`reusable_for`）随语义关系暂缓，当前 Wiki 文件没有任何 `relations` 声明。示例中的边名是 frontmatter `relations.type` 的 snake_case 值，入库后对应 PascalCase 关系表（见"关系表"一节）。

### 来源与概念

```text
backlog/wiki/sources/back-712.md
    --sourced_from-->
backlog/tasks/back-712 - Agents-miss-source_path-problems-during-wiki-lint-reviews.md

backlog/wiki/sources/back-712.md
    --links_to-->
backlog/wiki/concepts/wiki-lint.md

backlog/wiki/sources/back-712.md
    --tagged_with-->
topic/source-path
```

### 来源支持决策

```text
backlog/wiki/sources/back-712.md
    --supports-->
backlog/wiki/decisions/source-path-validation.md

backlog/wiki/decisions/source-path-validation.md
    --depends_on-->
backlog/wiki/concepts/source-provenance.md
```

### 模式复用

```text
backlog/wiki/patterns/skill-file-change-sync.md
    --reusable_for-->
backlog/wiki/execution/agent-guidance-sync.md

backlog/wiki/execution/agent-guidance-sync.md
    --derived_from-->
backlog/wiki/sources/back-712.md
```

## 7. 可视化规则

本期可画 `sourced_from`、`links_to`（机械引用边）、`tagged_with` 和一期任务边；下表中语义边样式属暂缓设计：

| 元素 | 建议表现 |

| 元素 | 建议表现 |
|---|---|
| 页面节点 | 主节点，显示标题或路径 |
| 标签节点 | 小号、低对比度节点 |
| `links_to`（正文 Wikilink 机械生成） | 浅灰色实线 |
| `sourced_from` | 蓝色实线 |
| `depends_on` | 橙色有向线 |
| `supports` | 绿色实线 |
| `contradicts` | 红色虚线 |
| `supersedes` | 紫色实线 |
| `tagged_with` | 细点线 |

默认隐藏标签节点。直接显示 `domain/wiki` 会把大量页面连接到一个中心节点，掩盖更有价值的语义关系。提供 `domain/`、`topic/`、`origin/` 和 `lifecycle/` 过滤条件。

## 8. Lint 规则

图谱 Lint 本期应报告：

- 缺失或格式错误的 `source_path`。
- `source_path` 在文件系统中不存在。
- `source_path` 对应多个候选来源。
- 正文 `[[wikilink]]` 目标无法唯一解析（未链接提及不报告——Obsidian 里的 unlinked mention 不是图谱事实）。正式缺陷只算“指向真实页面却解析不到唯一文件”那一类；正文里的示例占位符（如 `[[path/to/page]]`）、非 Markdown 资源嵌入（`![[assets/photo.png]]`）与白名单外目标（如 `wiki_output/`）单独归为 informational，不计入通过判定——当前 wiki 树的未解析命中全部属于后者。
- 重复或冲突的页面路径。
- 不符合约定命名空间的标签。
- 页面缺少 `file_type`，或 `file_type` 不是 `wiki`、`decision`、`document`。
- Source 页面没有可解析的溯源关系。

暂缓（语义关系启用后追加）：`relations.target` 指向不存在的文件；关系目标位于 `backlog/wiki/` 或明确允许的原始来源目录之外；语义关系的举证检查。Lint 通过不代表所有语义关系都正确——本期图谱只有溯源和标签，没有语义正确性问题。

## 9. 迁移顺序

本期执行：

1. 保持现有 Markdown 和 Wikilink 不变。
2. 为所有进入图谱的 Wiki、决策和文档文件补充显式 `file_type`；Source 页面同时核对 `source_path` 可达。（本期只交付机制与校验报告，**不执行**这一步迁移：现状是全部知识文件都没有 `file_type`，由 lint 报出，迁移留作后续任务。）
3. 逐步把现有 `labels` 规范化为带命名空间的受控标签。
4. 从 frontmatter 和正文 Wikilink 生成路径与标签索引（`type`/`labels`/`source_path`/`[[wikilink]]`）。
5. 增加 `source_path` 未解析、歧义候选和缺失 `file_type` 的 Lint 检查。
6. 增加带标签过滤的 Obsidian 兼容图谱视图（节点 + `TaggedWith` + `SourcedFrom`）。

暂缓（语义关系有真实需求时追加）：增加路径形式的 `relations` 并解析建边；`relations.target` 的 Lint 检查；语义关系可视化样式。

该顺序让现有 Wiki 持续可用，同时逐步增加机器可读语义。文件路径保持为唯一身份机制，标签保持为灵活的分类层。
