# HonKit 文档迁移工作流约定（Backlog.md 生态）

本文件记录把 Backlog.md 用户手册用 HonKit 构建并迁移进官网时的项目特定约定。
通用流程见 SKILL.md；这里是容易踩坑的细节与已敲定的决策。

## 1. 源（Source）

- **HonKit 启动位置是 wiki 根目录** `backlog/wiki`（不是 `usermanual` 子目录）。
  根目录含 `LANGS.md` + `book.json`，`book.json` 用 `ignores` 把 wiki 的其它内容
  （`concepts/`、`decisions/`、`index.md`、`log.md` 等）排除在构建外。
- 每个语言一册，各自是 GitBook 风格目录（`README.md` + `SUMMARY.md` + `NN-章节/`）：
  - `backlog/wiki/usermanual/` — 简体中文
  - `backlog/wiki/usermanual-en/` — 英文（文件名沿用中文目录名，正文与导航是英文）
- `LANGS.md` 内容即语言清单，脚本据此决定构建哪几册：
  ```markdown
  * [简体中文](usermanual/)
  * [English](usermanual-en/)
  ```
- **分支**：手册最新内容在 `wiki-tmp`；`release` 分支落后，`main` 分支**没有** wiki 目录
  （链接 `tree/main/backlog/wiki/...` 会 404）。构建必须显式 `--branch wiki-tmp`。
- 用 `git archive <branch> <src> | tar -x` 抽取，避免把仓库大历史带进来。
  `_book/` 已被 `.gitignore` 忽略，不会进归档，脚本会自己构建。

## 2. Wikilink 归一化（必须）

- 正文里的 `[[entity/foo|显示名]]` 与 `[[entity/foo]]` 是项目 wiki 的交叉引用语法，
  HonKit（GitBook）无法渲染，会原样显示成 `[[...]]`。
- 迁移脚本会将其转成可读文本：`[[a|b]]` -> `b`，`[[a]]` -> 取路径最后一段。
- 注意区分：描述「`[[` 实体链接自动补全」之类的**字面文本**不是 wikilink，保持原样。

## 3. Mermaid / ECharts 围栏（按决策不渲染）

- 手册正文大量使用 ```` ```mermaid ```` 和 ```` ```echarts ```` 围栏来教学图表语法。
- **项目决策：手册不需要捆绑 mermaid/echarts 运行时**，这些围栏由 HonKit 当作普通代码块
  显示源码即可（不会渲染成图）。**不要**注入 mermaid/echarts 的 CDN 或本地包。
- 若未来要渲染，再单独评估（且会引入离线/子路径问题）。

## 4. 链接必须是相对路径（子路径安全）

- 脚本对**每册单独构建**（`npx honkit build usermanual <out>`），产物自包含：
  `index.html` + 同级 `gitbook/` 资源 + 自己的 `search_index.json`，
  页面内引用是 `gitbook/style.css`、嵌套页 `../gitbook/...`。
- 因此手册可挂载在任意子路径下，无需改链接。官网部署在
  `https://kuwork.github.io/Backlog.md/` 下：中文 `docs/`、英文 `en/docs/`。
- **不要直接用多语言构建的 `backlog/wiki/_book/`**：那种产物把 `gitbook/` 放在
  `_book/gitbook` 共享，页面写成 `../gitbook/...`，挂到子路径会样式全丢；
  而且三个 `search_index.json` 都是同一份 5.5MB 双语索引，
  英文册搜索会命中中文页面。按语言单独构建后各为约 3.3MB 单语索引。

## 5. 迁移目标（Target）

- 官网源码仓库：`backlog-md-site`（纯静态站，资源用相对路径引用）。
- 中文册 → `backlog-md-site/docs/`，英文册 → `backlog-md-site/en/docs/`，
  每册约 6.4MB / 73 个文件 / 51 页；**剔除** `package.json` / `package-lock.json`
  （honkit 的 npm 产物，非站点资源）。目标目录每次整目录覆盖，避免残留旧页。
- 首页 `#docs` 区块的「用户手册」卡片：`index.html` 指向 `docs/`，
  `en/index.html` 指向 `docs/`（相对 `en/` 即 `en/docs/`）。
  不要指向失效的 GitHub wiki URL。
- 构建临时目录放站点仓库之外（如 `/d/tmp/um-build`），不要污染 `backlog-md-site`。

## 6. 部署（Deploy）

- 官网通过 `gh-pages` 孤儿分支发布，发布 worktree 在 `backlog-md-pages`。
- 同步方式：把 `backlog-md-site` 的 `index.html` 与 `docs/` 拷进 `backlog-md-pages/`，
  再在 worktree 里提交并推送（**提交/推送由用户执行**）。
- worktree 根目录已存在 `.nojekyll`，确保 `docs/gitbook/` 等不被 Jekyll 处理。

## 7. SEO 元信息（每次构建后必跑）

- 触发原因：HonKit 产物每页都带 `<meta name="description" content="">`（空），且没有
  canonical / OG / hreflang / JSON-LD；而这些页面是站点内容主体（中英各 51 页），
  空描述在搜索结果里只会显示抓取的片段。
- 工具：官网仓 `backlog-md-site/scripts/seo.py` + `seo.json`。构建（含 `--worktree`
  同步）之后跑一遍；它只改自己标记块 `<!-- seo:start --> … <!-- seo:end -->` 之间的内容，
  可重复执行。
- 每页注入：description（取正文第一段实质内容，跳过「执行以下命令…：」这类祈使句，
  上限 158 字）、canonical（目录页折叠为 `/docs/`）、OG/Twitter、hreflang
  （zh ↔ en 同名路径互指 + `x-default`）、`robots=index,follow`、JSON-LD
  `TechArticle` + `BreadcrumbList`。
- 面包屑只用**真实存在**的页面：HonKit 不给章节目录生成 `index.html`，
  所以 `docs/00-快速开始/` 这类无页目录要跳过，否则面包屑指向 404。
- URL 一律 percent-encode（中文目录名），sitemap 与 canonical 同形。
- `sitemap.xml` 由脚本重建：6 个静态页 + 102 个手册页，手册页带
  `xhtml:link rel="alternate"` 双语互指；`robots.txt` 的 `Sitemap:` 行必须指向它。
- **域名开关**：`seo.json` 的 `base_url` 是唯一入口，当前值
  `https://kuwork.github.io/Backlog.md`。此前用过的 `https://backlog.kuwork.cn`
  从未在 DNS 解析（NXDOMAIN），已废弃。
  - 页面里不要硬编码域名。手写的落地页（`index.html`、`en/index.html`、`v1/`、
    `privacy.html`、`terms.html`、`robots.txt`）里是绝对 URL，脚本会按
    `LEGACY_BASES` 把历史域名整体替换成当前 `base_url`；换域名时把旧值追加进
    这个列表即可，重复运行幂等。
  - `404.html` 会被在任意深度返回，链接必须是根绝对路径，因此要带部署子路径
    （`/Backlog.md/assets/…`）。脚本自动处理；部署在域名根目录（`base_url`
    无 path）时自动跳过。

## 8. 验证

- 用无头 Chrome（CDP）离线截图验证：`docs/index.html` 与任意嵌套内页
  （如 `docs/80-图谱与数据查询/06-图表块.html`）都应正常渲染侧栏与正文，无样式破损。
- 因无外部依赖，无需联网即可验证。

## 9. 同源待清理（超出本技能范围）

- 首页「Wiki 知识库」卡片仍指向 `main/backlog/wiki`（404）。它不是用户手册，
  本技能不处理；如要修复需另议（本地化 wiki 或改链接）。
