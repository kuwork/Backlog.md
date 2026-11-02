---
title: Shell Completions
labels: [usermanual]
created_date: 2026-05-07 00:00
updated_date: 2026-11-04 00:00
---

# Shell Completions

Backlog.md includes intelligent shell completion for bash, zsh, fish, and PowerShell. After enabling, press Tab while typing a `backlog` command in the terminal to auto-complete subcommands, options, and dynamic values, greatly improving efficiency.

## One-Click Completion Script Installation

Backlog.md provides automatic detection and installation based on the current shell type:

```bash
backlog completion install
```

After running, the tool detects your shell environment and installs the completion script to the corresponding location:

| Shell | Installation Location |
|-------|-----------------------|
| bash | `~/.bashrc` or `~/.bash_profile` |
| zsh | `~/.zshrc` |
| fish | `~/.config/fish/completions/` |
| PowerShell | `$PROFILE` file |

After installation, reload the shell configuration file or open a new terminal window for completions to take effect.

## Supported Shells

### Bash

The Bash completion script supports command, subcommand, and option completion. Dynamic value completion depends on the bash-completion package. It is preinstalled on most Linux distributions; if not, install it via the package manager:

```bash
# Debian/Ubuntu
sudo apt-get install bash-completion

# macOS (Homebrew)
brew install bash-completion
```

### Zsh

Zsh users can use completions directly with no extra dependencies. Zsh's completion system is feature-rich, supporting menu selection and description display, providing the most complete experience.

### Fish

Fish completion scripts are placed at `~/.config/fish/completions/backlog.fish`; Fish automatically loads all completion definitions in that directory. Fish completions support description text and argument highlighting.

### PowerShell

PowerShell completion is implemented by registering `Register-ArgumentCompleter`. The installation script automatically modifies the PowerShell configuration file (view the path via `$PROFILE`). To register manually, refer to the registration logic in the completion script.

## Dynamic Completion Capabilities

Backlog.md's completion system supports not only static commands and options, but also dynamically extracts real data from the current project:

### Actual Task IDs

After typing `backlog task edit `, press Tab to list all valid task IDs in the current project:

```bash
backlog task edit <TAB>
# shows: task-1  task-2  task-3  doc-1  ...
```

### Status Values

After typing `-s ` or `--status `, press Tab; the completion system reads the status list from the project config:

```bash
backlog task list -s <TAB>
# shows: To Do  In Progress  Done
```

### Labels

After typing `-l ` or `--labels `, press Tab; the completion system aggregates all labels already in use:

```bash
backlog task create "New feature" -l <TAB>
# shows: bug  feature  docs  backend
```

### Assignees

After typing `-a ` or `--assignee `, press Tab; the completion system lists all assignees that appear in existing tasks:

```bash
backlog task edit 1 -a <TAB>
# shows: @alice  @bob  @team-lead
```

Dynamic completion data comes from the Backlog.md project in the current working directory. If you run a command in a directory without a Backlog.md project, dynamic value completion falls back to an empty list or default values, but static command completion remains available.

## Manual Completion Script Installation

If automatic installation encounters issues, or you need to deploy completion scripts to a non-standard location, you can install manually. Backlog.md ships with completion script sources for each shell in the package.

### Finding Completion Scripts

Completion scripts are installed with the npm package, in the `completions/` folder of the package directory:

```bash
# Find the globally installed backlog.md package path
npm root -g
# Completion scripts are at:
# <npm-root>/backlog.md/completions/backlog.bash
# <npm-root>/backlog.md/completions/backlog.zsh
# <npm-root>/backlog.md/completions/backlog.fish
# <npm-root>/backlog.md/completions/backlog.ps1
```

### Manual Bash Installation

Add the following to `~/.bashrc`:

```bash
source /path/to/backlog.bash
```

### Manual Zsh Installation

Copy the completion script to a Zsh function search path, such as `~/.zsh/functions/`:

```bash
cp /path/to/backlog.zsh ~/.zsh/functions/_backlog
```

Ensure `~/.zshrc` includes that directory in `fpath`:

```zsh
fpath=(~/.zsh/functions $fpath)
```

### Manual Fish Installation

Copy the completion script to Fish's completions directory:

```bash
cp /path/to/backlog.fish ~/.config/fish/completions/backlog.fish
```

### Manual PowerShell Installation

Add the completion registration code to the PowerShell profile. First determine the profile path:

```powershell
$PROFILE
```

If the file does not exist, create it:

```powershell
New-Item -Path $PROFILE -ItemType File -Force
```

Then append the contents of `backlog.ps1` to the profile.

After manual installation, reload the shell configuration file or open a new terminal window for completions to take effect.
