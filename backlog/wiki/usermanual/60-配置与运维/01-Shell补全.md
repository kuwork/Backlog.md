---
title: Shell 补全
labels: [usermanual]
created_date: 2026-05-07 00:00
---


# Shell 补全

Backlog.md 内置智能 Shell 补全功能，支持 bash、zsh、fish 和 PowerShell。启用后，在终端中输入 `backlog` 命令时按 Tab 键，即可自动补全子命令、选项和动态值，大幅提升操作效率。

## 一键安装补全脚本

Backlog.md 提供自动检测和安装功能，根据当前使用的 Shell 类型自动配置补全脚本：

```bash
backlog completion install
```

执行后，工具会检测你的 Shell 环境，将补全脚本安装到对应位置：

| Shell | 安装位置 |
|-------|---------|
| bash | `~/.bashrc` 或 `~/.bash_profile` |
| zsh | `~/.zshrc` |
| fish | `~/.config/fish/completions/` |
| PowerShell | `$PROFILE` 文件 |

安装完成后，需要重新加载 Shell 配置文件或新开一个终端窗口，补全功能即可生效。

## 支持的 Shell

### Bash

Bash 补全脚本支持命令、子命令和选项补全。动态值补全依赖 bash-completion 包。在大多数 Linux 发行版中，该包已预装；如未安装，可通过包管理器获取：

```bash
# Debian/Ubuntu
sudo apt-get install bash-completion

# macOS (Homebrew)
brew install bash-completion
```

### Zsh

Zsh 用户可直接使用补全功能，无需额外依赖。Zsh 的补全系统功能丰富，支持菜单选择和描述显示，体验最为完整。

### Fish

Fish 的补全脚本放置在 `~/.config/fish/completions/backlog.fish`，Fish 会自动加载该目录下的所有补全定义。Fish 补全支持描述文本和参数高亮。

### PowerShell

PowerShell 补全通过注册 `Register-ArgumentCompleter` 命令实现。安装脚本会自动修改 PowerShell 的配置文件（可通过 `$PROFILE` 查看路径）。如需手动注册，可参考补全脚本中的注册逻辑。

## 动态补全能力

Backlog.md 的补全系统不仅支持静态命令和选项，还能从当前项目中动态提取实际数据：

### 实际任务 ID

输入 `backlog task edit ` 后按 Tab，补全系统会列出当前项目中所有有效的任务 ID：

```bash
backlog task edit <TAB>
# 显示：task-1  task-2  task-3  doc-1  ...
```

### 状态值

输入 `-s ` 或 `--status ` 后按 Tab，补全系统会从项目配置中读取状态列表：

```bash
backlog task list -s <TAB>
# 显示：To Do  In Progress  Done
```

### 标签

输入 `-l ` 或 `--labels ` 后按 Tab，补全系统会汇总所有已使用的标签：

```bash
backlog task create "新功能" -l <TAB>
# 显示：bug  feature  docs  backend
```

### 负责人

输入 `-a ` 或 `--assignee ` 后按 Tab，补全系统会列出所有现有任务中出现过的负责人：

```bash
backlog task edit 1 -a <TAB>
# 显示：@alice  @bob  @team-lead
```

动态补全的数据来源于当前工作目录下的 Backlog.md 项目。如果在没有 Backlog.md 项目的目录中执行命令，动态值补全会回退到空列表或默认值，但静态命令补全仍然可用。

## 手动安装补全脚本

如果自动安装遇到问题，或需要将补全脚本部署到非标准位置，可以手动安装。Backlog.md 在安装包中内置了各 Shell 的补全脚本源码。

### 查找补全脚本

补全脚本随 npm 包一起安装，位于包目录的 `completions/` 文件夹下：

```bash
# 查找全局安装的 backlog.md 包路径
npm root -g
# 补全脚本位于：
# <npm-root>/backlog.md/completions/backlog.bash
# <npm-root>/backlog.md/completions/backlog.zsh
# <npm-root>/backlog.md/completions/backlog.fish
# <npm-root>/backlog.md/completions/backlog.ps1
```

### Bash 手动安装

将以下内容添加到 `~/.bashrc`：

```bash
source /path/to/backlog.bash
```

### Zsh 手动安装

将补全脚本复制到 Zsh 的函数搜索路径，例如 `~/.zsh/functions/`：

```bash
cp /path/to/backlog.zsh ~/.zsh/functions/_backlog
```

确保 `~/.zshrc` 中的 `fpath` 包含该目录：

```zsh
fpath=(~/.zsh/functions $fpath)
```

### Fish 手动安装

将补全脚本复制到 Fish 的补全目录：

```bash
cp /path/to/backlog.fish ~/.config/fish/completions/backlog.fish
```

### PowerShell 手动安装

在 PowerShell 配置文件中添加补全注册代码。首先确定配置文件路径：

```powershell
$PROFILE
```

如果文件不存在，先创建它：

```powershell
New-Item -Path $PROFILE -ItemType File -Force
```

然后将 `backlog.ps1` 中的内容追加到配置文件中。

完成手动安装后，重新加载 Shell 配置文件或开启新终端窗口即可生效。
