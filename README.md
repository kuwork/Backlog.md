# Backlog.md 产品官网

纯静态站点，零构建。发布在 GitHub Pages 上，地址 `https://kuwork.github.io/Backlog.md/`。

## 两个版本

| 路径 | 说明 |
|---|---|
| `/` 和 `/en/` | 当前版本（v2）：开机序列、逐字上升标题、画布图谱、3D 悬浮、横向钉住流程、逐帧界面演示 |
| `/v1/` 和 `/v1/en/` | 第一版（保留）：经典分节布局，动效克制 |

两个版本共用 `assets/img/` 下的图标与旧截图，样式与脚本各自独立：`site.css` / `site.js` 服务 v1，`v2.css` / `v2.js` 服务 v2。页脚互相留有切换链接。

## 结构

```text
.
├── index.html          当前版本中文首页
├── en/index.html       当前版本英文首页
├── v1/index.html       旧版中文首页
├── v1/en/index.html    旧版英文首页
├── 404.html            品牌化 404
├── privacy.html        隐私说明
├── terms.html          使用条款
├── robots.txt
├── sitemap.xml
└── assets/
    ├── css/site.css    旧版设计系统
    ├── css/v2.css      当前版本设计系统与动效
    ├── js/site.js      旧版交互
    ├── js/v2.js        当前版本交互
    └── img/
        ├── v2/         当前版本界面截图
        └── ...         图标、分享图、旧版本截图
```

## 本地预览

不要直接双击打开文件，相对路径与本地服务行为不同：

```bash
bunx serve .
# 或
python -m http.server 8080
```

改完刷新即可，没有构建步骤。

## 发布到 GitHub Pages

站点作为 `kuwork/Backlog.md` 仓库的 `gh-pages` 分支发布（孤儿分支，只放站点文件），地址是项目页子路径 `https://kuwork.github.io/Backlog.md/`。本目录就是该分支的工作区，落地页改动直接提交推送即可。

用户手册（`docs/`、`en/docs/`）由 HonKit 从主仓库 `wiki-tmp` 分支的 `backlog/wiki` 构建，**不要手改里面的文件**——下次构建会整体覆盖。构建工具与说明都在 `.agents/skills/honkit-docs-migration/`，在本目录执行：

```powershell
# 构建中英手册并直接写入 docs/ 与 en/docs/
python .agents/skills/honkit-docs-migration/scripts/migrate_docs.py `
  --repo D:\git\Backlog.md --branch wiki-tmp --src backlog/wiki `
  --site . --docs-dir docs --work D:\tmp\um-build

# 注入 SEO 元信息并重建 sitemap.xml（每次构建后必跑）
python .agents/skills/honkit-docs-migration/scripts/seo.py `
  --site . --config .agents/skills/honkit-docs-migration/seo.json
```

域名替换、`404.html` 的子路径前缀补全均由 `seo.py` 按 `seo.json` 的 `base_url` 自动处理。之后提交并推送 `gh-pages`，Pages 源选 `gh-pages` + `/ (root)`。

因为地址是子路径，这里**不要**放 `CNAME` 文件——放了会把站点锁到自定义域名，`/Backlog.md/` 会 301 跳走。需要换回自定义域名时，再把 `CNAME` 放回 `gh-pages` 根目录，并同步改 `sitemap.xml`、`robots.txt` 与各页面的 canonical、og:url。


## 当前版本的动效清单

- 开机序列：命令行打字后揭开页面，仅首次访问触发，可跳过，有超时兜底
- 标题逐字上升，每个字符自带渐变切片（子元素的 transform 会破坏父级 `background-clip: text`，所以渐变下放到字符本身）
- 画布图谱背景：节点缓慢漂移，鼠标附近连成青色
- 屏幕截图跟随鼠标做 3D 倾斜，随滚动轻微缩放
- 光标光晕平滑跟随，触屏设备关闭
- 任务流跑马灯：两条轨道反向滚动，悬停暂停
- 工作方式区横向钉住推进，卡片聚焦放大，底部进度条同步
- 界面区逐帧切换：看板、甘特图、任务视图、数据查询
- 标语逐词点亮，数字滚动计数，磁吸按钮与双层文字
- 全部尊重 `prefers-reduced-motion`

## 改文案时注意

- 页面上不出现未核实的事实：没有用户数、星标数、下载量，也没有第三方证言。统计区的数字来自本仓库真实状态，并已在页面上写明来源。
- 字体走 jsdelivr 的 Geist，回退到系统字体；CDN 打不开时页面样式不受影响。
- `assets/img/v2/` 里的截图来自 `backlog browser` 的实际界面，用 Chrome 无头模式截取后压到 1400 像素宽。重新截图时保持同样的窗口宽度即可。
