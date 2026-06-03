---
title: npm 发布流程指南
created_date: 2026-06-02 17:00
updated_date: 2026-06-02 17:00
labels: [developer-note, npm, publish, release]
---

# npm 发布流程指南

Backlog.md 采用"主包 + 平台二进制包"的分发模式。发布到 npm 需要修改源码中的包名引用、构建二进制、处理平台包，并避开 npm 的版本号陷阱。

## 一、源码修改（Fork 必须）

将包名从 `backlog.md` 改为 scoped 包 `@kuwork/backlog.md`，需要改三处：

### 1. package.json

```json
{
  "name": "@kuwork/backlog.md"
}
```

同时 `optionalDependencies` 中的平台包也要改：

```json
"optionalDependencies": {
  "@kuwork/backlog.md-darwin-arm64": "*",
  "@kuwork/backlog.md-darwin-x64": "*",
  "@kuwork/backlog.md-linux-arm64": "*",
  "@kuwork/backlog.md-linux-x64": "*",
  "@kuwork/backlog.md-windows-arm64": "*",
  "@kuwork/backlog.md-windows-x64": "*"
}
```

### 2. scripts/resolveBinary.cjs

```js
function getPackageName(platform = process.platform, arch = process.arch) {
  return `@kuwork/backlog.md-${mapPlatform(platform)}-${mapArch(arch)}`;
}
```

### 3. scripts/cli.cjs

正则表达式支持可选的 `@kuwork/` 前缀：

```js
const pattern = /node_modules[/\\](@kuwork\/)?backlog\.md-(darwin|linux|windows)-[^/\\]+[/\\]backlog(\.exe)?$/i;
```

## 二、构建二进制

```bash
bun run build
```

产物在 `dist/backlog.exe`（Windows）或 `dist/backlog`（macOS/Linux）。

## 三、创建平台包

平台包只包含二进制，结构如下：

```
dist/platform-packages/windows-x64/
├── backlog.exe          # 构建产物
├── LICENSE              # 项目 LICENSE
└── package.json         # 平台包描述
```

`package.json` 示例：

```json
{
  "name": "@kuwork/backlog.md-windows-x64",
  "version": "1.45.2",
  "os": ["win32"],
  "cpu": ["x64"],
  "files": ["backlog.exe", "package.json", "LICENSE"],
  "license": "MIT"
}
```

## 四、npm 认证

### 4.1 注册与 Token

1. 访问 https://www.npmjs.com/signup 注册账号
2. 进入 https://www.npmjs.com/settings/{username}/tokens
3. 生成 **Granular Access Token**（新账户可能不支持 Classic Token）
4. 权限设置：
   - **Packages and Scopes**: ✅ **Read and write**
   - **Select Packages**: `@kuwork/backlog.md` 及各平台包
   - 开启 **"Bypass two-factor authentication"** 或等效选项（否则发布会被 403 拦截）

### 4.2 配置 Token

`npm login` 的 legacy 模式可能不识别 Granular Access Token。最可靠的方式是直接写入配置：

```bash
npm config set //registry.npmjs.org/:_authToken=你的token
```

验证：

```bash
npm whoami   # 应显示用户名
```

## 五、发布命令

### 5.1 平台包

```bash
cd dist/platform-packages/windows-x64
npm publish --access public
```

### 5.2 主包

```bash
cd ../../..
npm publish --access public
```

## 六、版本号陷阱（核心教训）

### 6.1 版本号永久锁定

**已发布的版本号永远无法再次使用**，即使执行 `npm unpublish` 删除也不行。`unpublish` 只是让用户无法安装旧包，版本号本身被 npm 永久保留。

### 6.2 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `Cannot publish over previously published version: 1.45.2` | 该版本号曾经发布过 | 升级版本号 |
| `Cannot implicitly apply the "latest" tag` | `latest` 已指向更高版本，现在发低版本 | 加 `--tag=stable` 或先删高版本 |
| `You must specify a tag using --tag` | 发布了 prerelease 版本（如 `1.45.2-CN`） | 加 `--tag latest` |
| `Two-factor authentication or granular access token...` | Token 缺少 bypass 2FA 权限 | 回 npm 网站编辑 Token 权限 |

### 6.3 版本号策略建议

- 首次发布前确认版本号未被占用
- 不要尝试用 `unpublish` 后重发同版本——不可能
- 如果 latest 指向了错误的版本，用 `npm dist-tag` 调整：
  ```bash
  npm dist-tag add @kuwork/backlog.md@1.45.4 latest
  ```

## 七、跨平台发布

当前仅发布了 Windows 平台包。macOS / Linux 用户安装时会报错 `Binary package not installed`。需要在对应系统上构建并发布：

```bash
# macOS (ARM64)
bun run build
# 创建 @kuwork/backlog.md-darwin-arm64 并发布

# Linux (x64)
bun run build
# 创建 @kuwork/backlog.md-linux-x64 并发布
```

或使用 GitHub Actions 跨平台 CI 自动构建发布。

## 八、README 同步

发布前记得同步 README 中的安装指令：

```bash
npm i -g @kuwork/backlog.md
```

brew / nix 指令仍指向原仓库（`MrLesk/Backlog.md`），如需 fork 版本也需自行维护对应的包管理器渠道。
