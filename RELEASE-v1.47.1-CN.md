## v1.47.1-CN Release Notes

> 上一个版本：[v1.46.0-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.46.0-CN)

### 🤖 Agent 与 CLI 工作流

- **CLI-first Agent 入口** — `backlog` 成为人类与 AI Agent 的默认入口，新增 `backlog instructions` 本地工作流指南
- **精简 Agent 提示** — 生成的 Agent 指导文件改用简短 CLI 提示，指向 `backlog instructions`，并保留用户已有内容
- **命令帮助增强** — 公共命令帮助包含文本输入模式说明（String / Markdown / Status / Task ID 等），方便 Agent 自纠正
- **自纠正错误提示** — 常见无效命令、选项、字段和值的错误会指向相关帮助或可用值
- **MCP 仍可选** — 原有 MCP 集成保留，继续作为可选连接器暴露工作流指南
- **里程碑 CLI 修复** — 在 BACK-401 日期字段基础上修复相关回归，命令帮助状态值使用实际配置状态，CLI 归档现在拒绝终端状态任务并提示 `backlog task complete`

### 🔌 MCP 集成修复

- **修复 Codex MCP 连接失败** — 根因是 Codex 可能启动到陈旧/损坏的编译产物，新增编译产物 MCP stdio 冒烟测试并统一 MCP 客户端设置辅助
- **修复 MCP 项目根目录解析** — 已初始化服务器现在跟随客户端 workspace roots，支持 git worktree 与多项目场景；`--cwd` / `BACKLOG_CWD` 可固定根目录

### 🌐 Web UI 与 Wiki 体验

- **全站图片 Lightbox 预览** — 所有图片支持点击全屏预览，支持缩放、旋转、平移、多图切换与键盘操作，零新增第三方依赖
- **Wiki Wikilink 别名与属性** — `[[target|alias]]` 别名支持 Markdown/HTML 行内格式，`[[target]]{...}` 支持 markdown-it-attrs 属性块，并修复 wiki/wiki_output 路径解析
- **媒体 Wikilink 支持** — 支持 `![[path]]`、`![[path|alt|WxH]]` 等 Obsidian 风格语法嵌入图片、视频与音频，图片复用 Lightbox 预览

### 📝 文档与技能

- **Wiki Skill 更新** — 同步 `llm-wiki-for-backlog` Skill 与嵌入式技能模块，补充别名、属性、媒体 Wikilink 说明
- **CLI 多行输入文档** — 更新 `agent-guidelines.md`、`CLI-INSTRUCTIONS.md` 及 CLI 任务创建/执行/收尾指南的多行输入说明
- **嵌入脚本修复** — 修复 `scripts/embed-wiki-skill.ts` 中的 `$` 转义问题
