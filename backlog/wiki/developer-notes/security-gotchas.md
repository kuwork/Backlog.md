---
type: developer-note
title: 安全检查清单
created: 2026-05-10
updated: 2026-05-10
---

# 安全检查清单

所有涉及外部输入、文件路径、网络请求的代码，必须过一遍下面的检查。漏掉任何一项都可能导致越权访问或信息泄露。

---

## 1. 文件系统路径访问安全

**来源**  
PR #634 (`/api/file-content`) 及后续审查要求：任何从客户端传入的文件路径，都必须经过严格的包含性校验，禁止目录遍历和绝对路径访问。

**必须做到的检查**

| 检查项 | 实现方式 | 错误示例 |
|---|---|---|
| **禁止 `../` 遍历** | `relative(rootDir, targetPath)` 后检查 `!rel.startsWith("..")` | 直接 `startsWith(rootDir)` 会被 `../../etc/passwd` 绕过 |
| **禁止绝对路径** | 检查 `!isAbsolute(filePath)` | `/etc/passwd` 或 `C:\Windows\System32` |
| **禁止目录读取** | `stat` 后检查 `!fileStats.isDirectory()` | 直接返回目录内容导致源码树暴露 |
| **文件大小上限** | `fileStats.size > MAX_FILE_SIZE` 时拒绝 | 无限制读取导致内存耗尽 |
| **根目录包含校验** | 同时检查 `!isAbsolute(rel)` | `relative()` 返回空字符串时误判 |

**参考实现**
```ts
const rootDir = resolve(this.projectRoot);
const targetPath = resolve(join(rootDir, filePath));
const rel = relative(rootDir, targetPath);
const isInside = !rel.startsWith("..") && !isAbsolute(rel);
if (!isInside || isAbsolute(filePath)) {
    throw new Error("Access denied");
}
```
- 位于：`src/file-system/operations.ts` `readProjectFile()`

---

## 2. 网络请求安全（URL 下载）

**来源**  
`src/core/assets.ts` `downloadImage()` — 用户可能通过上传接口传入内网 URL，导致 SSRF（服务器端请求伪造）。

**必须做到的检查**

| 检查项 | 规则 |
|---|---|
| **协议白名单** | 仅允许 `http:` / `https:` |
| **禁止 localhost** | `localhost`、`127.0.0.1`、`::1` |
| **禁止私有 IPv4** | `10.x.x.x`、`172.16-31.x.x`、`192.168.x.x` |
| **重定向跟踪** | 每次重定向后重新检查 hostname，防止跳转到内网 |
| **重定向次数上限** | 防止无限重定向循环 |

**参考实现**
```ts
const hostname = parsed.hostname.toLowerCase();
if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return null;
if (/^10\./.test(hostname)) return null;
if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return null;
if (/^192\.168\./.test(hostname)) return null;
```
- 位于：`src/core/assets.ts` `downloadImage()`

---

## 3. 新增 API / 功能时的安全自检

- [ ] 是否接收用户传入的文件路径？→ 执行路径包含性校验
- [ ] 是否接收用户传入的 URL？→ 执行协议 + hostname 黑名单校验
- [ ] 是否有文件大小 / 内存上限？→ 设置合理的 `MAX_FILE_SIZE`
- [ ] 是否涉及目录列表？→ 明确排除敏感目录（如 `.git`、`.env`）
- [ ] 错误信息是否暴露内部路径？→ 对外返回泛化错误 message，日志里再记录详细路径
