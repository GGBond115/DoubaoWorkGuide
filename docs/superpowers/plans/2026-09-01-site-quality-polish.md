# 网站质量与阅读体验优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提升豆包工作蓝皮书的首页启动速度、路由与阅读可靠性、正文视觉层级和项目文档准确性。

**Architecture:** 以生成式轻量索引承担首页、导读和目录首屏，完整正文按需和后台加载；保留纯静态部署。正文结构只增加统一内容图框，不改公开内容数据与路由格式。

**Tech Stack:** 原生 HTML、CSS、ES Modules、Node.js、Puppeteer Core、Cloudflare Pages 静态头配置。

**Spec:** `docs/superpowers/specs/2026-09-01-site-quality-polish-design.md`

## Global Constraints

- 保持 `site` 为可直接发布的纯静态目录，不增加运行时框架。
- 保留全部公开内容节点、媒体路径和现有 `#/p/<id>` 链接。
- 所有新增行为先写会失败的 Puppeteer 或 Node 断言，再做实现。
- 首页首屏不依赖完整正文和二维码库。
- 桌面端与 360/390 px 移动端不得产生横向溢出。
- 保留当前未提交的首页 Logo 蓝配色改动。

---

### Task 1: 建立严格审计门禁

**Files:**
- Create: `tools/audit-site.mjs`
- Modify: `tools/check-features.mjs`
- Modify: `tools/check-landing.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `site/content/site-content.json`、本地 `http://127.0.0.1:4173`
- Produces: `npm test` 与 `npm run audit`，失败行为返回非零退出码

- [x] **Step 1: 为继续阅读、目录跳转、离屏内容可见和正文内容框写失败断言**
- [x] **Step 2: 运行定向脚本，确认断言因现有缺陷失败**
- [x] **Step 3: 新增全站路由、媒体、横溢、控制台和关键链接审计脚本**
- [x] **Step 4: 在 `package.json` 中建立可重复运行的测试入口**
- [x] **Step 5: 运行静态审计并记录当前失败项**

### Task 2: 两阶段加载与缓存优化

**Files:**
- Create: `tools/build-site-index.mjs`
- Create: `site/content/site-index.json`
- Modify: `site/js/app.js`
- Modify: `site/index.html`
- Modify: `site/_headers`
- Test: `tools/audit-site.mjs`

**Interfaces:**
- Consumes: `site/content/site-content.json`
- Produces: `site/content/site-index.json`；`ensureFullContent()` 返回去重后的正文加载 Promise

- [x] **Step 1: 增加失败断言：首页首阶段不得请求完整正文或二维码库**
- [x] **Step 2: 运行性能断言并确认失败原因与关键请求链一致**
- [x] **Step 3: 实现可重复生成的轻量索引脚本并生成索引**
- [x] **Step 4: 改造启动与路由，使非正文页先用索引渲染，正文按需加载**
- [x] **Step 5: 将二维码库改为分享时动态加载**
- [x] **Step 6: 为版本化资源和哈希媒体配置长期缓存**
- [x] **Step 7: 运行弱网与请求清单测试，确认首页首阶段缩短且正文导航正常**

### Task 3: 修复阅读恢复与导航验收

**Files:**
- Modify: `site/js/app.js`
- Modify: `tools/check-features.mjs`
- Modify: `tools/check-landing.mjs`

**Interfaces:**
- Consumes: `dwg.resume` 的 `{ token, y }`
- Produces: 布局完成后的滚动恢复；可判错的目录跳转测试

- [x] **Step 1: 保持失败断言，定位滚动值被过早覆盖的执行顺序**
- [x] **Step 2: 在两帧布局后恢复位置，恢复期间不覆盖保存值**
- [x] **Step 3: 使用路由条件等待替代固定 500 ms 等待**
- [x] **Step 4: 运行继续阅读、目录、键盘导航与页内锚点回归**

### Task 4: 子页面内容图框与章节可视化

**Files:**
- Modify: `site/js/app.js`
- Modify: `site/css/article.css`
- Test: `tools/audit-site.mjs`

**Interfaces:**
- Consumes: `viewDoc(entry)` 生成的正文或章节概览 HTML
- Produces: `.article__body-frame`、`.article__body-label` 和二级标题自动编号

- [x] **Step 1: 增加失败断言，检查正文图框、左右边线、标题编号与移动端不溢出**
- [x] **Step 2: 在正文和章节概览外增加语义清晰的统一容器**
- [x] **Step 3: 实现桌面端规线、角标、底纹、标签和标题编号**
- [x] **Step 4: 实现 720 px 与 390 px 下的紧凑边框与排版回退**
- [x] **Step 5: 渲染代表性长文、表格、代码、图片和章节页并逐张回看**

### Task 5: 可见性、搜索语义与文档一致性

**Files:**
- Modify: `site/css/layout.css`
- Modify: `site/index.html`
- Modify: `site/js/app.js`
- Modify: `README.md`
- Test: `tools/audit-site.mjs`

**Interfaces:**
- Consumes: 首页滚动观察器与搜索结果状态
- Produces: 默认可见的首页内容；具备 `aria-controls`、`aria-expanded` 和活动项关联的搜索框；准确 README

- [x] **Step 1: 增加失败断言，检查离屏卡片透明度和搜索语义**
- [x] **Step 2: 取消离屏内容的透明隐藏，只保留可降级的位移动效**
- [x] **Step 3: 补齐搜索输入与结果列表的可访问状态同步**
- [x] **Step 4: 统一 README 的正式名称、能力、真实文件路径、运行与测试命令**
- [x] **Step 5: 运行文档路径、内容数量和站内名称一致性检查**

### Task 6: 全量本地部署验收

**Files:**
- Modify: `docs/superpowers/plans/2026-09-01-site-quality-polish.md`

**Interfaces:**
- Consumes: 本计划全部产物
- Produces: 可复核的测试输出、性能对比、桌面与移动端截图、最终分支状态

- [x] **Step 1: 运行 `npm test` 与 `npm run audit`，确认零失败**
- [x] **Step 2: 在模拟弱网下复测首页可见时间和关键请求清单**
- [x] **Step 3: 生成首页、目录、章节页、正文页的 1440 px 与 390 px 截图**
- [x] **Step 4: 检查 58 个路由、520 个媒体路径、外部导航、控制台与横向溢出**
- [x] **Step 5: 运行 `git diff --check`，复核改动清单与计划覆盖关系**

