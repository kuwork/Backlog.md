---
title: 开发指引
labels:
  - develop
updated_date: '2026-05-15 09:34'
---
# 开发指引 — Bun + TypeScript + Biome 技术栈

> 本文档规范了基于 Bun 运行时、TypeScript 语言和 Biome 工具链的项目的开发标准与工作流。
> 适用于 CLI 工具、Web 应用及库的开发。

---

## 1. 技术栈概览

| 层级 | 技术选择 | 说明 |
|------|----------|------|
| 运行时 | [Bun](https://bun.sh) | 替代 Node.js，内置包管理器、测试运行器、打包工具 |
| 语言 | TypeScript 5 | 严格模式，目标 ESNext |
| 代码质量 | [Biome](https://biomejs.dev) | 格式化 + 静态分析，替代 Prettier + ESLint |
| 版本控制 | Git + Husky | 预提交钩子自动检查代码 |
| 包管理 | Bun 内置 | `bun.lock` 锁定依赖版本 |

---

## 2. 环境要求

- **Bun** >= 1.0（建议始终使用最新稳定版）
- **Git** >= 2.30
- 操作系统：macOS / Linux / Windows（WSL 或 Git Bash）

### 环境验证

```bash
# 检查 Bun 版本
bun --version

# 安装依赖
bun install

# 验证完整环境
bun run check        # 代码检查
bun test             # 运行测试
bunx tsc --noEmit    # 类型检查
```

---

## 3. 项目初始化模板

### 3.1 基础目录结构

```
project-name/
├── src/                    # 源代码
│   ├── commands/           # CLI 命令实现
│   ├── core/               # 核心业务逻辑
│   ├── utils/              # 工具函数
│   ├── types/              # 类型声明
│   └── index.ts            # 入口文件
├── scripts/                # 构建/发布脚本
├── dist/                   # 构建产物（gitignore）
├── tests/                  # 测试文件（或 *.test.ts 放 src/ 旁）
├── backlog/                # 任务管理（如使用 Backlog.md）
├── biome.json              # Biome 配置
├── tsconfig.json           # TypeScript 配置
├── package.json            # 包配置
├── bunfig.toml             # Bun 配置（可选）
├── .gitignore
└── DEVELOPMENT-GUIDE.md    # 本文件
```

### 3.2 配置文件规范

#### `tsconfig.json`

```json
{
	"compilerOptions": {
		"lib": ["ESNext", "DOM"],
		"target": "ESNext",
		"module": "Preserve",
		"moduleDetection": "force",
		"jsx": "react-jsx",
		"allowJs": true,
		"moduleResolution": "bundler",
		"allowImportingTsExtensions": true,
		"verbatimModuleSyntax": true,
		"noEmit": true,
		"strict": true,
		"skipLibCheck": true,
		"typeRoots": ["./src/types", "./node_modules/@types"],
		"noFallthroughCasesInSwitch": true,
		"noUncheckedIndexedAccess": true,
		"noImplicitOverride": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,
		"noPropertyAccessFromIndexSignature": false
	},
	"exclude": []
}
```

**关键规则说明：**

| 规则 | 设置 | 目的 |
|------|------|------|
| `strict` | `true` | 启用全部严格类型检查 |
| `noUncheckedIndexedAccess` | `true` | 索引访问返回 `\| undefined`，强制空值检查 |
| `noUnusedLocals/Parameters` | `true` | 禁止未使用的变量和参数 |
| `verbatimModuleSyntax` | `true` | 区分类型导入 `import type` 与值导入 |
| `noEmit` | `true` | 仅做类型检查，由 Bun 负责编译/打包 |

#### `biome.json`

```json
{
	"$schema": "https://biomejs.dev/schemas/2.4/schema.json",
	"vcs": {
		"enabled": true,
		"clientKind": "git",
		"useIgnoreFile": true
	},
	"files": {
		"ignoreUnknown": false,
		"includes": ["src/**/*.ts", "scripts/**/*.{ts,js}", "*.json"]
	},
	"formatter": {
		"enabled": true,
		"indentStyle": "tab",
		"lineWidth": 120
	},
	"assist": {
		"actions": {
			"source": { "organizeImports": "on" }
		}
	},
	"linter": {
		"enabled": true,
		"rules": {
			"recommended": true,
			"style": {
				"noParameterAssign": "error",
				"useAsConstAssertion": "error",
				"useDefaultParameterLast": "error",
				"useEnumInitializers": "error",
				"useSelfClosingElements": "error",
				"useSingleVarDeclarator": "error",
				"noUnusedTemplateLiteral": "error",
				"useNumberNamespace": "error",
				"noInferrableTypes": "error",
				"noUselessElse": "error"
			}
		}
	},
	"javascript": {
		"formatter": { "quoteStyle": "double" }
	}
}
```

**代码风格摘要：**

- 缩进：**Tab**（非空格）
- 引号：**双引号**
- 行宽：120 字符
- 自动组织导入顺序
- 末尾逗号：使用 Biome 默认值

#### `package.json` 关键字段

```json
{
	"type": "module",
	"module": "src/index.ts",
	"scripts": {
		"test": "bun test",
		"format": "biome format --write .",
		"lint": "biome lint --write .",
		"check": "biome check .",
		"check:types": "bunx tsc --noEmit",
		"build": "bun build --production --minify src/index.ts --outdir=dist",
		"prepare": "husky"
	},
	"lint-staged": {
		"*.json": ["biome check --write --files-ignore-unknown=true"],
		"src/**/*.{ts,js}": ["biome check --write --files-ignore-unknown=true"]
	}
}
```

---

## 4. 开发工作流

### 4.1 日常开发循环

```bash
# 1. 创建功能分支
git checkout -b feature/xxx

# 2. 编码（遵循下方代码规范）
# ...

# 3. 保存前自动格式化与检查（推荐在编辑器中配置 Biome 插件）

# 4. 提交前手动检查
bun run check        # 格式 +  lint
bunx tsc --noEmit    # 类型检查
bun test             # 运行测试

# 5. 提交（触发预提交钩子）
git commit -m "feat: 描述信息"
```

### 4.2 编辑器配置

**VS Code 工作区设置：**

```json
{
	"editor.defaultFormatter": "biomejs.biome",
	"editor.formatOnSave": true,
	"editor.codeActionsOnSave": {
		"quickfix.biome": "explicit",
		"source.organizeImports.biome": "explicit"
	},
	"typescript.preferences.importModuleSpecifier": "relative",
	"typescript.tsdk": "node_modules/typescript/lib"
}
```

**必需插件：**

- Biome（官方插件，替代 Prettier + ESLint 插件）

---

## 5. 代码规范

### 5.1 TypeScript 编写原则

#### 强制严格模式

```typescript
// ❌ 禁止隐式 any
function bad(x) { return x + 1; }

// ✅ 显式标注类型
function good(x: number): number { return x + 1; }
```

#### 索引访问必须做空值检查

```typescript
const map: Record<string, number> = { a: 1 };

// ❌ 可能运行时错误
const val = map["b"].toString();

// ✅ 安全访问
const val = map["b"];
if (val !== undefined) {
	console.log(val.toString());
}
```

#### 区分类型导入与值导入

```typescript
// ✅ 类型仅导入
import type { Config } from "./types";

// ✅ 值导入
import { loadConfig } from "./config";

// ✅ 混合导入
import { type User, createUser } from "./user";
```

#### 禁止重新赋值函数参数

```typescript
// ❌ 禁止
function process(data: string) {
	data = data.trim();
}

// ✅ 使用新变量
function process(data: string) {
	const trimmed = data.trim();
}
```

### 5.2 命名约定

| 类型 | 命名风格 | 示例 |
|------|----------|------|
| 文件/目录 | kebab-case | `task-manager.ts`, `file-system/` |
| 类/接口/类型 | PascalCase | `TaskManager`, `UserConfig` |
| 函数/变量 | camelCase | `loadConfig`, `taskList` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT`, `MAX_RETRY` |
| 枚举 | PascalCase + 成员大写 | `enum Status { ACTIVE, INACTIVE }` |
| 布尔变量 | 前缀 is/has/should | `isEnabled`, `hasPermission` |

### 5.3 函数与模块设计

```typescript
// ✅ 优先纯函数
function calculateTotal(items: Item[]): number {
	return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ 单一职责，参数对象化
interface CreateUserOptions {
	name: string;
	email: string;
	role?: "admin" | "user";
}

function createUser(options: CreateUserOptions): User {
	const { name, email, role = "user" } = options;
	// ...
}

// ✅ 提前返回，减少嵌套
function validateInput(input: string): Result {
	if (input.length === 0) {
		return { ok: false, error: "Empty input" };
	}
	if (!input.includes("@")) {
		return { ok: false, error: "Invalid format" };
	}
	return { ok: true, value: input };
}
```

### 5.4 错误处理

```typescript
// ✅ 使用 Result 模式替代抛出异常
interface Ok<T> { ok: true; value: T }
interface Err<E> { ok: false; error: E }
type Result<T, E = string> = Ok<T> | Err<E>;

function parseConfig(raw: string): Result<Config> {
	try {
		const parsed = JSON.parse(raw);
		return { ok: true, value: parsed };
	} catch {
		return { ok: false, error: "Invalid JSON" };
	}
}

// 使用时必须处理错误分支
const result = parseConfig(configText);
if (!result.ok) {
	console.error(result.error);
	process.exit(1);
}
```

---

## 6. 测试规范

### 6.1 测试文件位置

- 与源文件并列：`src/utils/helpers.test.ts`
- 或集中目录：`tests/helpers.test.ts`

### 6.2 测试基本模式

```typescript
import { describe, expect, test } from "bun:test";
import { calculateTotal } from "./cart";

describe("calculateTotal", () => {
	test("空数组返回 0", () => {
		expect(calculateTotal([])).toBe(0);
	});

	test("计算多个项目总和", () => {
		const items = [
			{ price: 10 },
			{ price: 20 },
		];
		expect(calculateTotal(items)).toBe(30);
	});

	test("负数价格抛出错误", () => {
		expect(() => calculateTotal([{ price: -1 }])).toThrow();
	});
});
```

### 6.3 测试原则

1. **独立性**：每个测试不依赖其他测试的状态
2. **确定性**：相同的输入永远产生相同的输出
3. **边界覆盖**：空值、极值、错误输入
4. **行为描述**：测试名称应描述行为，而非实现细节

---

## 7. Git 工作流

### 7.1 分支模型

```
main              生产分支，始终保持可发布状态
  │
  ├─ feature/xxx  功能分支
  ├─ fix/xxx      修复分支
  ├─ refactor/xxx 重构分支
  └─ docs/xxx     文档分支
```

### 7.2 提交信息规范

```
<类型>: <简短描述>

[可选的详细正文]

[可选的 footer]
```

**类型：**

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式调整（不影响功能） |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具链更新 |

**示例：**

```bash
git commit -m "feat: 添加任务批量导入功能"
git commit -m "fix: 修复索引越界导致的崩溃

当任务列表为空时，访问 items[0] 会抛出异常。
现已添加边界检查。"
```

### 7.3 预提交检查

Husky 会在每次 `git commit` 前自动运行：

```bash
biome check --write --files-ignore-unknown=true <staged-files>
```

若检查失败，提交将被阻止。修复问题后重新提交。

---

## 8. 构建与发布

### 8.1 开发构建

```bash
# 运行 CLI 或应用（开发模式）
bun src/cli.ts

# 带热重载
bun --watch src/cli.ts
```

### 8.2 生产构建

```bash
# 编译为可执行文件或 JS bundle
bun build --production --minify --compile src/cli.ts --outfile=dist/app

# 或输出为 JS bundle
bun build --production --minify src/index.ts --outdir=dist
```

### 8.3 发布检查清单

- [ ] `bun test` 全部通过
- [ ] `bunx tsc --noEmit` 无类型错误
- [ ] `bun run check` 无格式/lint 错误
- [ ] 版本号已在 `package.json` 更新
- [ ] `CHANGELOG.md` 已更新
- [ ] 文档已同步

---

## 9. 项目特定扩展

### 9.1 CLI 工具额外规范

- 使用 `commander` 或 `clack` 处理命令行交互
- 所有命令输出通过 `picocolors` 着色
- 提供 `--help` 和 `--version` 支持
- 错误码统一：0=成功, 1=一般错误, 2=用法错误

### 9.2 Web 应用额外规范

- 使用 React + Tailwind CSS（当前项目选型）
- 构建 CSS：`bun ./node_modules/@tailwindcss/cli/dist/index.mjs -i src/styles/source.css -o src/styles/style.css --minify`
- 服务端路由优先于客户端路由（如使用 React Router）

### 9.3 库包额外规范

- `package.json` 中配置 `files` 字段精确控制发布内容
- 提供 `.d.ts` 类型声明（如 Bun 未自动生成）
- 遵循语义化版本控制（SemVer）

---

## 10. 附录

### 常用命令速查

| 命令 | 作用 |
|------|------|
| `bun install` | 安装依赖 |
| `bun add <pkg>` | 添加运行时依赖 |
| `bun add -d <pkg>` | 添加开发依赖 |
| `bun test` | 运行测试 |
| `bun test <file>` | 运行单个测试文件 |
| `bun run check` | 运行 Biome 格式+lint 检查 |
| `bun run format` | 格式化代码 |
| `bunx tsc --noEmit` | 类型检查 |
| `bun build src/index.ts` | 构建 |
| `bun --watch src/index.ts` | 开发模式（热重载） |

### 推荐资源

- [Bun 文档](https://bun.sh/docs)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Biome 规则参考](https://biomejs.dev/linter/rules/)

---

*本指引基于 Backlog.md 项目实践总结，随技术演进持续更新。*
