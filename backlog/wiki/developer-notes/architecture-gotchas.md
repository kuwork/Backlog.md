---
title: 架构分层规范
labels: [developer-note]
created_date: 2026-05-10 00:00
updated_date: 2026-10-09 23:30
---

# 架构分层规范

给后续维护者和 AI agent 的架构约束。核心原则：**HTTP handler 只负责 I/O 适配，业务逻辑必须下沉到 core 层。**

---

## Server 层禁止直接拥有文件读取/解析逻辑

**来源**  
PR #634 Review ([MrLesk](https://github.com/MrLesk))：  
> 请不要把项目文件读取/解析直接放进 `src/server/index.ts`。新的 `/api/file-content` handler 目前自己负责路径解析、遍历策略、文件 IO、行切片和响应组装。这些逻辑应该放在一个小的、有测试覆盖的 core/filesystem API 后面，server 只负责适配 HTTP 输入/输出。

**禁止行为**
- 在 `src/server/index.ts` 的 handler 里直接做路径解析、目录遍历安全检查、文件读写、行范围切片、响应体组装。
- 把未经验证的 `rawPath` 直接传给 `Bun.file()` 或 `fs.readFile()`。

**正确分层**
| 职责 | 归属 |
|---|---|
| 解析 HTTP query/body | `src/server/index.ts` handler |
| 调用核心 API | `this.core.filesystem.xxx(...)` |
| 路径安全校验（`../` 拦截、绝对路径拒绝、根目录包含检查） | `src/file-system/operations.ts` |
| 文件 IO、行切片、大小限制 | `src/file-system/operations.ts` |
| 错误映射到 HTTP status code | `src/server/index.ts` handler |

**参考实现**
- `src/server/index.ts` `handleGetFileContent()` — 仅提取 `path` query param，调用 `this.core.filesystem.readProjectFile()`，将错误 message 映射到 400/403/404/500。
- `src/file-system/operations.ts` `readProjectFile()` — 负责行范围解析 (`:10-20`)、`relative` + `isAbsolute` 包含检查、5MB 大小限制、目录拒绝、行切片、返回结构化对象。

---

## 新增 Server API 时的自检清单

- [ ] handler 里是否还包含"应该属于 core 层"的逻辑？
- [ ] 是否有对应的 `FileSystem` / `Core` 方法承载业务规则？
- [ ] 该方法是否有单元测试覆盖（路径安全、边界条件、错误分支）？
- [ ] handler 里的错误处理是否只负责 HTTP status 映射，不解释业务错误细节？

## Related Concepts

- [[developer-notes/security-gotchas]] — 路径包含性校验等安全检查清单
- [[developer-notes/DEVELOPMENT-GUIDE]] — Bun + TypeScript + Biome 技术栈通用开发规范
