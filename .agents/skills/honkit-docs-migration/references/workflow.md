# HonKit 文档迁移工作流约定（Backlog.md 生态）

本文件记录把 Backlog.md 用户手册用 HonKit 构建并迁移进官网时的项目特定约定。
通用流程见 SKILL.md；这里是容易踩坑的细节与已敲定的决策。

## 1. 源（Source）

- 用户手册源码在 `backlog/wiki/usermanual`，采用 GitBook 风格目录结构：
  `README.md`（封面/简介）+ `SUMMARY.md`（导航）+ `NN-章节/` 编号子目录。
- **分支**：源码只在 `release` 分支（以及若干版本分支）上。`main` 分支**没有** wiki 目录，
  直接链接 `github.com/kuwork/Backlog.md/tree/main/backlog/wiki/...` 会得到 404。
- 用 `git archive <branch> <src> | tar -x` 抽取，避免把仓库大历史带进来。

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

- HonKit 产物（`_book/`）内部全部使用相对链接：`gitbook/style.css`、
  `00-快速开始/00-产品概述.html`、`../gitbook/...`（嵌套页用 `../`）。
- 因此手册可挂载在任意子路径下，无需改链接。官网部署在
  `https://kuwork.github.io/Backlog.md/` 下，手册放在 `docs/` 即 `.../Backlog.md/docs/`。

## 5. 迁移目标（Target）

- 官网源码仓库：`backlog-md-site`（纯静态站，资源用相对路径引用）。
- 手册放到 `backlog-md-site/docs/`，覆盖 `_book/` 的全部内容，
  **剔除** `package.json` / `package-lock.json`（honkit 的 npm 产物，非站点资源）。
- 首页 `#docs` 区块的「用户手册」卡片链接必须指向本地 `docs/`，
  不要指向失效的 GitHub `main` wiki URL。

## 6. 部署（Deploy）

- 官网通过 `gh-pages` 孤儿分支发布，发布 worktree 在 `backlog-md-pages`。
- 同步方式：把 `backlog-md-site` 的 `index.html` 与 `docs/` 拷进 `backlog-md-pages/`，
  再在 worktree 里提交并推送（**提交/推送由用户执行**）。
- worktree 根目录已存在 `.nojekyll`，确保 `docs/gitbook/` 等不被 Jekyll 处理。

## 7. 验证

- 用无头 Chrome（CDP）离线截图验证：`docs/index.html` 与任意嵌套内页
  （如 `docs/80-图谱与数据查询/06-图表块.html`）都应正常渲染侧栏与正文，无样式破损。
- 因无外部依赖，无需联网即可验证。

## 8. 同源待清理（超出本技能范围）

- 首页「Wiki 知识库」卡片仍指向 `main/backlog/wiki`（404）。它不是用户手册，
  本技能不处理；如要修复需另议（本地化 wiki 或改链接）。
