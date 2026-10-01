---
id: doc-20
title: 快速笔记：Memos 集成
type: other
created_date: '2026-10-01 09:15'
updated_date: '2026-10-01 09:15'
---
想把 Memos 的「日历 + 轻笔记」搬进来。

- 主打快速捕获，写完即存，不追求格式
- 复用已有的 `task-back-709` 依赖端点思路
- 时间倒序 + 滚动分页加载


---

## 1. 为什么做、怎么做到「轻」

Backlog.md 已经具备两件事，正好是 Memos 的短板：

- **Markdown 渲染 + 知识网互联**：本项目有**两套互不相干**的链接机制——`src/web/utils/wikiLinks.ts` 只解析 `[[wiki/path]]`（及媒体链接）到 `/wiki/...`；`TaskIdIndexContext`（`src/web/contexts/TaskIdIndexContext.tsx` → `task-id-links.ts`）只把**裸写**的实体 ID（`task-123`/`doc-001`/`decision-1`/`draft-104`）经 remark 插件自动链接到对应路由。注意：`[[...]]` 在本项目**仅表示 wiki 路径**，不存在 `[[task-123]]` 这种实体括号语法；`TaskIdIndexContext` 索引 `task/doc/decision/draft` 四类实体 + `wikiPaths` 路径列表（wiki 不是实体 kind），**不含 memo**。
- **本地优先、纯文件存储**：所有实体都是 `backlog/<kind>/*.md` 的 frontmatter 文件，随 git 走、可 grep、可外部编辑。

因此「轻改动」的落地策略 = **新增一种与 `docs` 同构的实体 `memo`**，把它的存储、API、搜索、渲染全部挂到既有管线上，再补两个视图（信息流 + 日历）。不碰 Kuzu 图谱核心、不碰状态机、不改现有实体读写契约。

---

## 2. Memos 能力与痛点 ↔ 本方案映射

| Memos 做得好的 | Memos 用户痛点（来自社区反馈与评测） | Backlog.md 现状 | 本方案如何解 |
|---|---|---|---|
| 极简捕获（Twitter 式信息流） | **自托管门槛高**（必须 Docker 起服务） | 本地文件 + 已有 Web UI | 沿用现有 `bun src/cli.ts` Web，无额外部署 |
| 日历弱/孤立 | **日历只是独立页面，与笔记流无联动** | memo 自带日期、信息流按时间排 | 单页双模式：`/memos` 内 [信息流]⇄[日历] 共享 `selectedDate`，点日历某天即把信息流过滤到那天（联动内置，非跨页） |
| 标签 `#tag` | **标签系统反直觉**（label 需「名称+搜索条件」才生效） | `labelColors`、任务 labels | memo 用简单 `tags: []`，渲染为只读 chip，不强制搜索语义 |
| Markdown + 附件 | **笔记是「死胡同」**：写完后无法推进成任务 | 已有 `draft → task` 提升通道（`promoteDraft`） | **本期不做 memo → task 提升**：memo 定位为轻笔记，写完即存；若需推进成任务，用户可在任务里引用该 memo 的 URL / 编号（出站引用，见 §5.7），提升通道留待后续评估 |
| SQLite 本地存储 | **数据锁在 SQLite**，不可 git、不可 grep、不可外部编辑 | 纯 Markdown 文件 | memo 即 `backlog/memos/*.md`，天然可版本化 |
| 轻量 | 笔记**彼此孤立**，与任务/文档无关联 | 知识网互联 | memo 正文裸写 `task-123`/`doc-001`（实体索引自动链接）+ `[[wiki/path]]`（wikiLinks 解析），**挂到既有知识网**（见 §5.7，杀手锏；注意 `[[...]]` 只表示 wiki 路径，实体 ID 是裸写） |
| 多用户 | 移动端缺失、仅 Web | 复用现有 React Web | Web 端加信息流/日历即覆盖；移动端后续可走 PWA（不在 v1） |

**结论**：本方案不是把 Memos 搬进来，而是把 Memos 的「捕获 + 日历」作为**入口**，把它的「死胡同笔记」变成 Backlog.md 知识网的一个**可生长节点**。

---

## 3. 总体方案概述

新增一种实体 **`memo`（轻笔记 / 瞬记）**，与 `document / decision` 同构：

- **存储**：`backlog/memos/*.md`（**独立兄弟目录，不复用 `doc` 通道**——`doc` 通道强制 `doc-NNN` ID，不满足 memo 的「日期+序号」需求；目录首次写入时由 memo 存储逻辑自动创建，等价于 `file-system/operations.ts` 的目录确保逻辑）。
- **一个新页面 + 两种视图模式（共享状态，天然联动）**：
  - `/memos` 单页，顶部切换 **[信息流] / [日历]** 两种模式，二者共享同一份 memo 数据与 `selectedDate` 状态：
    - **信息流模式**：Twitter 式卡片流，顶部 Quick Capture，**时间倒序**，**分页加载（滚动到底自动拉取下一页，IntersectionObserver）**；标签筛选；若选中了某天则只显示那天（顶部出现 `📅 2026-10-01 ✕` 可清除）。
    - **日历模式**：月历，每日 memo 数量热力；**点击某天 = 把信息流过滤到那天并切回信息流模式**（共享同一 `selectedDate`）；从信息流点「📅 日历」则打开日历并高亮当天。日历与信息流再无独立页面、无跨页跳转，联动是内置行为。
  - 深层链接：`/memos?view=calendar&date=2026-10-01` 可直接定位；侧栏只保留一个 `Memos` 入口（不再单独放 Calendar）。
- **三条集成链路（复用既有）**：
  1. 全局搜索：memo 进入 `/api/search`，可 `type=memo` 过滤（复用 `core/search-service.ts`）。
  2. 知识网互联：memo 正文通过两套既有机制挂到知识网（**非「`[[...]]` 解析到实体」**，二者机制不同）：
     - 裸写实体 ID（`task-123`/`doc-001`/`decision-1`）由 `TaskIdIndexContext` 提供的实体索引经 `createEntityLinkPlugin`（remark 插件）自动链接到 `/task/123`、`/documentation/1` 等路由；
     - `[[wiki/path]]` 由 `wikiLinks.ts` 的 `prepareWikiMarkdown` 解析到 `/wiki/...`。
     memo 本身**不作为链接目标**（按本期决策：只做 memo→他人的出站引用，doc/wiki 反向引用 memo、memo→memo 均不做；故不需扩展 `EntityKind` 或新增 `/memo/:id` 路由，见 §5.7）。
- **提升通道（memo → task）本期不做**：memo 定位为轻笔记，写完即存，不复用 `draft → task` 提升协议。若后续需要衔接任务，复用出站引用（在任务正文里引用 memo 的 URL / 编号，见 §5.7）即可，无需在 memo 端新增提升入口。
- **实时同步**：复用 WS 广播，新增 `memos-updated`（与 `documents-updated` 同级）。

---

## 4. 数据模型（memo Markdown 文件）

**memo 不复用 `doc` 通道**：`doc` 通道强制 `doc-NNN` ID（见 `src/guidelines/cli-instructions/documents.md` 的 doc ID 要求），无法满足 memo 的「日期+序号」ID 与「一般无标题」特性。因此 memo 走**独立轻量存储**（新建 `src/core/memos.ts`，约 60 行，复用 `file-system/operations.ts` 的目录/读写与 `markdown/frontmatter.ts` 的序列化）：

- **ID 格式**：`YYYYMMDD-N`（日期 + 当日序号，如 `20261001-1`、`20261001-2`）。同日序号扫描当日最大号 +1，无需全局锁；跨天自然归零。
- **一般无标题**：文件名即 `<id>.md`（如 `20261001-1.md`），frontmatter 不含 `title`；信息流卡片的展示标题由正文**首行**派生（无首行则取正文前 40 字符）。
- **追加正文**：用 `writeFileUtf8` 整文件写回（memo 体量小，无需 doc 的 append 协议）。

文件示例（规格示意）：

```markdown
---
id: 20261001-1
created_date: '2026-10-01 09:15'
updated_date: '2026-10-01 09:15'
tags: [idea]
---

想把 Memos 的「日历 + 轻笔记」搬进来。
- 主打快速捕获，写完即存
- 复用已有的 `task-back-709` 依赖端点思路
- 时间倒序 + 滚动分页加载
```

要点：

- **ID 由 memo 存储逻辑生成**：`nextMemoId(root)` 读 `backlog/memos/` 下 `YYYYMMDD-*` 文件，取当日最大序号 +1（约 5 行），不依赖 `generateNextDocId`、不进 doc 索引。
- **不引入 `Document` 类型 / `type` 字段**：memo 是独立轻实体，只含 `id / created_date / updated_date / tags / 正文`，避免被 `content-store` 的 doc 管线误扫。
- **不引入 `pinned` / `related` 等字段**：置顶 / 关联等需求留到 v2（置顶可用独立轻量标记或正文 `[[wikilink]]`）。
- **正文支持 Markdown**；裸写 `task-xxx`/`doc-xxx` 由实体索引自动链接，写 `[[wiki/path]]` 由 wikiLinks 解析（注意本项目 `[[...]]` 只表示 wiki 路径，无 `[[task-...]]` 这种实体括号语法）。
- **排序与分页**：按 `created_date` **倒序**（字符串比较即时间序，`id` 作稳定 tiebreaker），服务端游标分页，前端无限滚动消费（见 §5.2、附录 B）。

---

## 5. 架构落地（按现有代码精确映射）

### 5.1 数据层 —— 新增 `src/core/memos.ts`（独立轻量存储）

**不复用文档通道**；本模块自管「生成 ID / 列出 / 读取 / 创建 / 更新 / 删除 / 分页」，**全部复用 `file-system/operations.ts` 与 `markdown/frontmatter.ts` 的既有工具**（无新依赖、无新序列化器）：

```ts
import { readFileUtf8, writeFileUtf8, listMarkdownFiles, ensureDir } from "../file-system/operations.ts";
import { parseFrontmatter, stringifyFrontmatter } from "../markdown/frontmatter.ts";
import { join } from "node:path";

export interface Memo {
  id: string;                 // YYYYMMDD-N
  createdDate: string;        // 'YYYY-MM-DD HH:mm'
  updatedDate?: string;
  tags: string[];
  displayTitle: string;       // 派生：正文首行（无则前 40 字符）
  rawContent: string;         // 不含 frontmatter
  path: string;
}

const MEMO_DIR = join("backlog", "memos");

/** 日期+序号 ID：当日最大号 +1，跨天归零（无需全局锁） */
export async function nextMemoId(root: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const dir = join(root, MEMO_DIR);
  const seqs = (await listMarkdownFiles(dir))
    .map((f) => f.match(new RegExp(`${today}-(\\d+)`)))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => Number(m[1]));
  const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
  return `${today}-${next}`;
}

async function toMemo(file: string): Promise<Memo> {
  const raw = await readFileUtf8(file);
  const { data, content } = parseFrontmatter(raw);
  const firstLine = content.trim().split("\n")[0] ?? "";
  return {
    id: String(data.id ?? ""),
    createdDate: String(data.created_date ?? ""),
    updatedDate: data.updated_date ? String(data.updated_date) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    displayTitle: firstLine || content.trim().slice(0, 40),
    rawContent: content,
    path: file,
  };
}

const MEMO_PAGE_SIZE = 30;

/** 时间倒序分页：cursor = 上一页末条 id，limit 默认 30 */
export async function listMemosPage(
  root: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<{ items: Memo[]; nextCursor: string | null }> {
  const dir = join(root, MEMO_DIR);
  await ensureDir(dir);
  const all = (await Promise.all((await listMarkdownFiles(dir)).map(toMemo)))
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate) || b.id.localeCompare(a.id));
  const limit = opts.limit ?? MEMO_PAGE_SIZE;
  const start = opts.cursor ? all.findIndex((m) => m.id === opts.cursor) + 1 : 0;
  const items = all.slice(start, start + limit);
  const last = items[items.length - 1];
  const nextCursor = last && start + limit < all.length ? last.id : null;
  return { items, nextCursor };
}

/** 创建：生成日期+序号 ID，写 <id>.md（无 title） */
export async function createMemo(root: string, content: string, tags: string[] = []): Promise<Memo> {
  const dir = join(root, MEMO_DIR);
  await ensureDir(dir);
  const id = await nextMemoId(root);
  const now = formatNowLocal(); // 'YYYY-MM-DD HH:mm' 本地时间
  const fm = stringifyFrontmatter({ id, created_date: now, updated_date: now, tags });
  const file = join(dir, `${id}.md`);
  await writeFileUtf8(file, `${fm}\n${content}\n`); // LF 行尾，走 frontmatter 归一
  return toMemo(file);
}
// updateMemo / deleteMemo / getMemo 同理：readFileUtf8 → parseFrontmatter → 改 → stringifyFrontmatter → writeFileUtf8
```

> 不接入 `ContentStore` 的重量级 snapshot/epoch 刷新体系（那是给 task/wiki 用的）。memo 走独立的轻量加载 + WS 增量广播，等价于 `DraftsList` 现在的做法（`window.dispatchEvent(new Event("memos-updated"))`）。这样 v1 完全不碰 `content-store.ts`。

### 5.2 服务端 —— `src/server/index.ts` 路由表（镜像 `/api/docs`）

现有路由表写法（第 616–669 行附近）：

```ts
"/api/docs": { GET: ..., POST: ... },
"/api/docs/:id": { GET: ..., PUT: ... },
"/api/docs/tree": { GET: ... },
```

新增镜像（约 6 行量级）：

```ts
"/api/memos": { GET: listMemosPageHandler, POST: createMemoHandler },            // GET 支持 ?limit=&cursor=&date=YYYY-MM-DD（date 存在时只返回那天，按时间倒序分页）
"/api/memos/calendar": { GET: memoCalendarHandler },                            // ?year=2026&month=10 → { "2026-10-01": 3, "2026-10-03": 1, ... } 每日 memo 计数（热力用，纯扫描分桶，零新存储）
"/api/memos/pinned": { GET: listPinnedMemosHandler },                            // 常驻顶部的置顶 memo
"/api/memos/:id": { GET: getMemoHandler, PUT: updateMemoHandler, DELETE: deleteMemoHandler },
"/api/memos/:id/pin": { POST: togglePinHandler },
# 提升通道（memo → task）本期不做，故无 /api/memos/:id/promote
```

处理器内部直接调用 `src/core/memos.ts`，鉴权/锁文件复用 `file-system/operations.ts` 既有逻辑（与 doc/decision 同款）。

### 5.3 搜索集成 —— `src/core/search-service.ts` + `src/types/index.ts`

轻量扩展，不破坏现有联合类型：

```ts
// types/index.ts
export type SearchResultType = "task" | "document" | "decision" | "wiki" | "memo"; // 仅加 "memo"
export interface MemoSearchResult { type: "memo"; score: number | null; memo: Memo; matches?: SearchMatch[]; }
export type SearchResult = ... | MemoSearchResult;
```

`search-service.ts` 内新增一个 `collectMemos(core)` 分支（与 `collectDocuments` 并列），把 `listMemos()` 结果投喂进既有评分/匹配管线。全局搜索对话框（`SearchDialog`）无需改代码即自动包含 memo。

### 5.4 前端 API Client —— `src/web/lib/api.ts`

沿用 `ApiClient` 单例，新增方法（与 `fetchDocs/createDoc/updateDoc` 同构）：

```ts
// 分页拉取：返回本页 items + 下一页游标（null 表示到底，时间倒序）
async fetchMemosPage(limit = 30, cursor?: string): Promise<{ items: Memo[]; nextCursor: string | null }> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set("cursor", cursor);
  return this.fetchJson(`${API_BASE}/memos?${qs.toString()}`);
}
// 置顶 memo（常驻顶部，不参与无限滚动分页）
async fetchPinnedMemos(): Promise<Memo[]> { return this.fetchJson<Memo[]>(`${API_BASE}/memos/pinned`); }
async createMemo(content: string, tags: string[]): Promise<Memo> { ... POST ... }
async updateMemo(id: string, patch: Partial<Memo>): Promise<Memo> { ... PUT ... }
async deleteMemo(id: string): Promise<void> { ... DELETE ... }
async pinMemo(id: string): Promise<void> { ... POST /memos/:id/pin ... }
# promoteMemo 本期不做（提升通道不在本期范围）
```

### 5.5 两个新页面

**`src/web/components/MemosPage.tsx`（`/memos`）**

- 顶部 **Quick Capture**：复用现成的 `PasteAwareMDEditor`（`src/web/components/PasteAwareMDEditor.tsx`）——它已经支持粘贴图片/文件，零新代码。
- 卡片流：每张卡片 = 一个 memo，顶部显示 `StoredDate`（`src/web/components/StoredDate.tsx`，已有），正文用现有 markdown 预览组件渲染（与 `DocumentationDetail` 同款渲染管线）。
- `pinned` 的 memo 置顶；`tags` 渲染为只读 chip（复用 `ChipInput` 的展示态或简单 span）。
- 标签筛选条复用 `LabelFilterDropdown`（`src/web/components/LabelFilterDropdown.tsx`）。
- **分页 / 无限滚动**：进入页面先 `fetchPinnedMemos()` 渲染置顶区块（常驻顶部、不参与滚动）；主信息流用 `fetchMemosPage(30)` 取第一页，用 `IntersectionObserver` 观察列表底部 sentinel，滚到底自动 `fetchMemosPage(30, nextCursor)` 追加，直到 `nextCursor === null` 显示到底态。首次加载与每次追加均显示 loading 态；空态显示引导文案。

**`src/web/components/MemosPage.tsx`（`/memos`，单页双模式，联动核心）**

- 组件持有 `view: "feed" | "calendar"` 与 `selectedDate: string | null` 两个状态，二者共享同一份 memo 数据（`fetchMemosPage` 拉取的分页结果 + `fetchMemoCalendar` 拉取的月度计数）。
- **输入框（常驻顶部，两种模式都可见）**：一个清晰的捕获区——`textarea`（占位「随手记点什么…」）+「保存」按钮（⌘/Ctrl+Enter 同效），复用 `PasteAwareMDEditor` 的渲染能力（支持 Markdown、自动识别 `#` 标签、粘贴图片）。提交即 `POST /api/memos`，新 memo 立刻插入信息流顶部（若正按 `selectedDate` 过滤且该日期匹配，则一并插入）。日历模式下该框也常驻，保证「任何视图都能随手记」。
- **信息流模式**：与 §5.4 同款卡片流（时间倒序、无限滚动、标签筛选）；若 `selectedDate` 非空，则只渲染那天，顶部出现 `📅 {selectedDate} ✕` 芯片可清回全部。
- **日历模式**：纯 CSS grid + Tailwind 主题令牌（不引第三方库）。先用 `fetchMemoCalendar(year, month)` 拿每日计数，格子底色按数量做强度梯度（复用 `labelColors` 调色板思路），高亮「今天」。**点击某天 → 在日历下方就地展开「当日面板」（不跳走信息流）**：面板列出该天 memo 卡片，并自带一个「给 {date} 加一条」输入框 + 保存按钮（写入即标为那天，可回填过去日期）。面板顶部的「在信息流中查看这天 →」才是跳去信息流并按该天过滤的次要动作。再点同格或面板「✕」收起。点信息流里的「📅 日历」回到本月历并高亮 `selectedDate`。
- 两个模式复用同一个 memo 卡片组件（含 `StoredDate`、`task-xxx` 渲染管线），无重复实现。
- v2：日历可叠加任务 `dueDate`、决策 `date`（复用既有日期字段，无新存储）；`selectedDate` 范围可扩成多选/区间。

### 5.6 导航 / 路由 / i18n 接线

- `src/web/App.tsx`：在 `Layout` 路由组下只加**一条**路由（日历是页内模式，不是独立路由）：
  ```tsx
  <Route path="memos" element={<MemosPage .../>} />   // 日历/信息流均为其页内模式，共享 selectedDate
  ```
  并（可选）在 `loadAllData` 之外走 `DraftsList` 同款独立 `fetchMemos` 拉取，避免污染既有 `tasks/docs/decisions` 刷新契约。
- `src/web/components/SideNavigation.tsx`：在 Tasks 分组末尾加**一个** `NavLink`（Memos），图标复用 `Icons` 对象里现成的字形（或新增一个 SVG，约 15 行）。折叠态也加对应图标入口。日历入口不再单独出现——它是 `/memos` 页内的模式切换。
- i18n：`src/web/locales/{zh-CN,zh-TW,en,ja}.ts` 的 `nav` 段加 `memos` 一个 key；页内「信息流 / 日历」切换文案同样进 locale（4 个文件各约 3 行），与现有 `t.nav.tasks` 等用法一致。

### 5.7 知识网互联（memo 出站引用，复用既有渲染管线）

**范围界定（按用户决策）**：**只考虑 memo → task/doc/decision/wiki 的出站引用；不考虑 doc/wiki 反向引用 memo，也不做 memo→memo 互联。** 因此**不需要**把 `memo` 加进 `EntityKind`、不需要 `/memo/:id` 路由、不需要扩展 `TaskIdIndexProvider`——这些都属于「让 memo 成为链接目标」，本期不做。

memo 引用别人，靠的是本项目**已经存在**的两套机制，memo 只要把正文喂进同一条 markdown 渲染管线即可，**零新解析代码**：

1. **裸写实体 ID（自动链接）**：正文里直接写 `task-123` / `doc-001` / `decision-1` / `BACK-709`，`task-id-links.ts` 的 remark 插件（`createEntityLinkPlugin`）会经 `TaskIdIndexContext` 提供的实体索引自动转成 `/task/123`、`/documentation/1` 等路由链接。task/doc/decision/draft 四类均原生支持。
2. **wikilink** `[[wiki/path]]`：`wikiLinks.ts` 的 `prepareWikiMarkdown` 解析到 `/wiki/...`。
3. **URL**：标准 markdown 链接或 autolink（如 `https://...`、`/task/123`），由既有渲染管线处理。

只要 memo 卡片/详情渲染时处于 `TaskIdIndexProvider` 作用域内（与 doc/wiki 同一套 Provider），上述三类引用即自动可点——**彻底解决 Memos「笔记孤立」的痛点**；且 memos 之间、doc/wiki 到 memo 都不需要任何额外接线。

**可选增强：书写时弹窗插入引用**。在输入框旁放一个「🔗 插入引用」按钮，点击弹出搜索框（复用既有实体索引 + `wikiPaths`），按关键词搜 task/doc/decision/wiki，选中后插入对应 token（实体 ID / `[[wiki/path]]` / URL）。这是本期唯一可能新增的 UI 件，纯前端、不碰存储与解析，且**可选**（用户也可以直接手敲实体编号 / wikilink / URL）。

### 5.8 提升通道（memo → task）本期不做

本期**不实现** memo → task 提升，理由与设计取舍：

- memo 定位为「轻笔记 / 快速捕获」，写完即存；把它做成「可提升为任务」会引入任务写入路径、字段映射、卡片「已提升」状态等复杂度，与「轻改动」目标相悖。
- 衔接任务的诉求可用**现有出站引用**满足：在任务正文里裸写 memo 编号 / 粘贴 memo URL（见 §5.7，memo 已被 `backlog/memos/*.md` 落盘、可寻址），无需在 memo 端新增提升入口。
- 若后续确需从 memo 一键建任务，可独立评估：届时复用 `draft → task` 提升协议（`promoteDraft` → `/api/drafts/:id/promote`）作为蓝本，但属于后续增量，不在本期范围。

### 5.9 实时同步

- 服务端处理 memo 写操作后 `broadcastDataUpdated("memos")`（复用现有 `broadcastDataUpdated(scope)` 75ms 去抖机制，见工作记忆）。
- `App.tsx` 的 WS `onmessage` 加一个 `else if (event.data === "memos-updated")` 分支，调用 `refreshMemosData()`（与 `refreshDocumentsData` 同构的轻量 GET）。
- 外部编辑器改了 `backlog/memos/*.md` → 文件系统 watcher（可复用 `content-store.ts` 里既有的 `createDocumentWatcher` 思路，或 server 侧既有文件监听）→ 触发同一广播。

### 5.10 配置（v1 可选，默认零配置）

v1 **不需要**改 `config.yml`：`backlog/memos/` 首次写入时自动创建（复用 `file-system/operations.ts` 的目录确保逻辑）。

后续可选项（不在 v1）：`config.yml` 增加 `memo_calendar_overlay_tasks: true`、`memo_default_tags` 等。保持 v1 配置面零改动。

---

### 5.11 CLI 命令（新增 `memo` 子命令，不复用 `doc`）

由于 memo **不复用 doc 通道**（ID 为日期+序号、一般无标题），v1 即需新增一个轻量 `memo` 子命令，内部调用 `src/core/memos.ts`（见 §5.1），不复用 `core.createDocumentFromInput`：

```ts
const memoCmd = program.command("memo");
memoCmd.command("create")
  .option("-c, --content <text>", "memo body")
  .option("-t, --tags <tags>", "comma-separated tags")
  .action(async (options) => {
    const root = await requireProjectRoot();
    const memo = await createMemo(root, options.content ?? "", (options.tags ?? "").split(",").filter(Boolean));
    console.log(`Created memo ${memo.id}`);   // 形如 20261001-1
  });
memoCmd.command("list")
  .option("-l, --limit <n>", "page size", "30")
  .action(async (options) => {
    const { items, nextCursor } = await listMemosPage(await requireProjectRoot(), { limit: Number(options.limit) });
    for (const m of items) console.log(`${m.id}\t${m.displayTitle}`);
    if (nextCursor) console.log(`(more: --cursor ${nextCursor})`);
  });
memoCmd.command("update <id>")
  .option("--content <text>", "replace body")
  .option("--append <text>", "append a line")
  .action(async (id, options) => { /* readFileUtf8 → parseFrontmatter → 改 → writeFileUtf8 */ });
memoCmd.command("delete <id>").action(async (id) => { /* unlink */ });
```

> Web 端 Quick Capture 走 `POST /api/memos`（见 §5.2），服务端委托 `src/core/memos.ts` 的 `createMemo`，与 CLI 同源（同一套日期+序号 ID 逻辑）。

---

## 6. 与 Memos 痛点逐一兑现（验收视角）

| Memos 痛点 | 本方案兑现方式 | 落地文件 |
|---|---|---|
| 必须自托管 | 沿用本地文件 + 现有 Web，无新部署 | 既有 |
| 笔记是死胡同 | **本期不做 memo → task 提升**：memo 为轻笔记，写完即存；衔接任务用出站引用在任务里引用 memo（§5.7），提升通道留待后续评估 | 无新增（复用既有引用机制） |
| 笔记彼此孤立 | memo 出站引用 task/doc/decision/wiki（§5.7） | 复用 `task-id-links.ts`（裸实体 ID 自动链接）+ `wikiLinks.ts`（`[[wiki/path]]`）+ URL；出站引用零新解析代码 |
| 日历只是过滤器 | 信息流⇄日历单页联动：点日→信息流过滤到那天（§5.5） | `MemosPage.tsx` |
| 标签反直觉 | 简单 `tags` 只读 chip，无搜索语义负担 | `MemosPage.tsx` |
| 数据锁死 SQLite | 纯 Markdown，可 git/grep/外部编辑 | `core/memos.ts` |
| 捕获摩擦大 | Quick Capture 复用 `PasteAwareMDEditor` | 既有组件 |
| 搜索不到笔记 | 进全局 `/api/search`（§5.3） | `search-service.ts` + `types` |

---

## 7. 实施分期（可逐期交付、每期独立可用）

**M0 — 数据层 + API（约 1 天）**
- `src/core/memos.ts`（CRUD + 列表）
- `src/server/index.ts` 新增 `/api/memos*` 路由（镜像 docs）
- 冒烟：用 `curl` 直接打 API 验证读写

**M1 — 信息流页（约 1.5 天）**
- `MemosPage.tsx` + Quick Capture（复用 `PasteAwareMDEditor`）
- `api.ts` 方法 + `SideNavigation` 入口 + i18n
- 卡片复用 `StoredDate` 与现有 markdown 预览

**M2 — 日历模式（约 1.5 天，并入 MemosPage）**
- `MemosPage.tsx` 的日历模式：月历热力 + `fetchMemoCalendar` + 点日→`selectedDate`→切回信息流过滤
- 复用 `LabelFilterDropdown` 做标签筛选

**M3 — 集成增强（约 2 天，可拆分）**
- 搜索接入（`search-service.ts` + types）
- 知识网互联（memo 渲染接入既有 `TaskIdIndexContext`/`task-id-links.ts` 实体索引 + `wikiLinks.ts`，出站引用 task/doc/wiki；可选「🔗 插入引用」弹窗，见 §5.7）
- WS 实时广播 `memos-updated`
- （memo → task 提升本期不做，见 §5.8）

> 即便只做 M0+M1，用户已得到一个可立即使用的「本地轻笔记信息流」；M2/M3 是叠加价值。分期即轻量化的体现。

---

## 8. 轻量化与风险评估

**刻意不做（保持轻）：**
- 不引入新数据库 / Kuzu 图谱节点（memo 默认不进 `graph`，如需可 v2 加 `GraphNodeKind` 的 `"memo"`，约 30 行）。
- 不引入第三方日历/编辑器库（复用 Tailwind + 现有 MDEditor）。
- 不改动 `content-store.ts` 的 snapshot 体系（memo 走独立轻量加载）。
- 不改动状态机、任务读写契约、既有实体 frontmatter。

**风险与缓解：**
- *frontmatter 归一*：memo 写回必须经 `serializeDocument` 走既有 LF 归一，避免行尾污染（工作记忆已记录此门禁）。
- *ID 冲突*：memo ID 形如 `YYYYMMDD-N`（日期+当日序号），与 task/doc/decision 的 `*-NNN` 前缀天然不同构，不触发 `prefix-migration`；同日序号靠扫描当日最大号 +1，无需全局锁。
- *搜索性能*：memo 量大时 `search-service` 已是按需 `collect*`，与 docs 同量级，无额外开销。
- *i18n 遗漏*：4 个 locale 文件各加 2 key，有既有 `index.ts` 类型约束，缺 key 编译即报错。

---

## 9. 验收标准（Definition of Done）

1. `backlog/memos/` 下新建 `.md` 即被 `/api/memos` 列出；文件可直接用外部编辑器增删改并即时在 Web 反映。
2. `/memos` 信息流可 Quick Capture、可按标签筛选；正文 Markdown + wikilink 正确渲染；**滚动到底自动加载下一页、到底有终止态、时间倒序最新在前**（置顶 pinned 留 v2）。
3. `/memos` 单页内 [信息流]⇄[日历] 联动：月历热力按 memo 日期聚合，点某天即把信息流过滤到该日并显示清除芯片；从信息流可回日历并高亮所选日。
4. 全局搜索（`/api/search?type=memo` 与无 type 全量）包含 memo。
5. memo 正文裸写 `task-xxx`/`doc-001` 自动链接、写 `[[wiki/path]]` 点击可跳转到对应实体/wiki 页。
6. 外部改 `backlog/memos/*.md`，Web 经 WS 广播在数秒内刷新（无需手动刷新）。
7. （memo 卡片「提升为任务」不在本期范围，见 §5.8）
8. 4 个 locale 均含 `memos` / `calendar` 文案；`bunx tsc --noEmit` 与 `bun run check .` 通过。

---

## 附录 A：最小 memo 文件示例

```markdown
---
id: 20261001-1
created_date: '2026-10-01 09:15'
updated_date: '2026-10-01 09:15'
tags: [idea]
---

给 BACK-709 的弹窗补一个「依赖来源」标签，参考 `task-back-709` 的 AC #9。
```
（以上为符合本规范的 memo 示例：日期+序号 ID、无 `title` 字段、文件名即 `20261001-1.md`。）

## 附录 B：API 草图（镜像 docs）

```
GET    /api/memos?limit=30&cursor=<id>   → { items: Memo[]; nextCursor: string|null }   # 时间倒序游标分页
GET    /api/memos/pinned                 → Memo[]                                          # 置顶 memo，常驻顶部
POST   /api/memos                        { content, tags[] } → Memo
GET    /api/memos/:id          → Memo
PUT    /api/memos/:id          { content?, tags? } → Memo
DELETE /api/memos/:id          → 204
# 置顶(pinned) 为 v2 能力：POST /api/memos/:id/pin → Memo(pinned 翻转)、GET /api/memos/pinned
# 提升通道(memo → task) 本期不做，无 /api/memos/:id/promote
```

## 附录 C：UI 线框（文字版）

```
侧边栏（Tasks 组底部）
  └─ 📋 Memos            ← 唯一入口；日历是页内模式，不是独立页

/memos   [ 信息流 | 日历 ]   ← 顶部模式切换，共享 selectedDate

┌─ 输入框（常驻顶部，两种模式都可见）──────────────────────┐
│ 📝 [ 随手记点什么…                         ]  [保存]      │
│     ⌘/Ctrl+Enter 保存 · 支持 #标签 / Markdown / 粘贴图片    │
└─────────────────────────────────────────────────────────┘

── 信息流模式（默认；时间倒序 · 无限滚动）──
  📅 2026-10-01 ✕          ← 选中某天才出现，点 ✕ 清回全部
  · memo B · 2026-10-01 09:30 · #idea
  · memo A · 2026-10-01 18:12 · #meeting
  · (滚动到底自动加载下一页)
  [加载中] / [已到底]

── 日历模式 ──
  ┌────── 2026-10 ── ◀ ▶ · 今天 ──────┐
  │ Mo Tu We Th Fr Sa Su              │
  │      ..  .. [2] [5] [3] ..        │   ← 数字=当日 memo 数，底色=强度
  │ ..  ..  ..  ..  ..  ..  ..        │      ●当天高亮
  └────────────────────────────────────┘
  ▸ 点 [5]（10-01）→ 不跳走，日历下方就地展开「当日面板」：
      ┌─ 10-01 当日（3 条）──────────────────┐
      │ · memo B · 09:30 · #idea              │
      │ · memo A · 18:12 · #meeting           │
      │ 📝 [ 给 10-01 加一条… ]      [保存]    │  ← 日历内直接写当天笔记（可回填过去日期）
      │ 「在信息流中查看这天 →」               │  ← 次要动作：跳去信息流并过滤
      └──────────────────────────────────────┘
  ▸ 再点同格或面板「✕」收起；信息流里的「📅 日历」回到本月历并高亮选中日
```
