# Handoff Report — Architecture Explorer (handoff.md)

## 1. Observation (观测事实)

1. **项目配置文件与依赖声明**：
   - 文件路径：`package.json`
     - `"name": "3d-wave-grid"`, `"type": "module"`
     - `"scripts": { "dev": "vite", "build": "vite build" }`
     - 依赖：`gsap: ^3.15.0`, `lil-gui: ^0.21.0`, `mitt: ^3.0.1`, `stats.js: ^0.17.0`, `three: ^0.184.0`；开发依赖：`vite: ^8.0.13`
   - 文件路径：`vite.config.js`
     - `root: "src/"`, `publicDir: "../public/"`, `outDir: "../dist"`, `base: "./"`
     - 缺少多页面输入配置（`rollupOptions.input`），仅对 `src/index.html` 进行单入口编译。

2. **目录分布与双页面架构**：
   - 主页位置：`src/index.html`，引入 `./style.css` 与 ES 模块 `./script.js`。
   - 画廊页位置：`public/gallery.html`，为独立单页面，直接内联 CSS 与 JS。
   - 画廊页外部依赖（`public/gallery.html` 行 210）：
     `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>`
   - 画廊页标题（`public/gallery.html` 行 6）：
     `<title>Ivy Lawon</title>`（拼写错误，缺少字母 's'）。

3. **构建测试结果**：
   - 执行命令：`npm run build`
   - 输出结果：
     - Exit Code: 0，构建耗时 636ms。
     - 生成产物：`dist/index.html` (1.72 kB), `dist/assets/index-CgD1P6Ps.css` (3.99 kB), `dist/assets/index-DO6H6dq7.js` (659.46 kB)。
     - 警报提示：`(!) Some chunks are larger than 500 kB after minification.`

4. **静态资源体积测量**：
   - 命令：`Get-ChildItem -Recurse public | Select-Object Name, Length`
   - `public/img/` 下 13 张照片（`0.png` ~ `12.png`）均为 PNG 原图，单张大小在 1.59MB 至 2.97MB 之间，总计约 **27.6 MB**。
   - `public/image.png` 大小为 **1.96 MB**。
   - `public/favicon.jpg` 大小为 **304 KB**。

5. **代码缺陷与异味观测**：
   - 文件路径：`src/ThreeJS/Orchestrator.js` 行 102：
     `this.camera.controls.dispose();`
     而在 `src/ThreeJS/Camera.js` 中没有定义 `this.controls` 属性（行 139 中被注释为 `// this.controls.update();`）。调用 `orchestrator.destroy()` 会触发 `TypeError: Cannot read properties of undefined (reading 'dispose')`。
   - 文件路径：`src/script.js` 行 8-23：
     包含 `updateTime()` 函数与 `setInterval(updateTime, 60000)`，试图查询已不存在的 DOM 元素 `document.getElementById("local-time")`。
   - 文件路径：`src/style.css` 行 46-56、116-136：
     存在大量残留类名的 CSS 规则（`.hero-section`, `.nav-links`, `.nav-socials`, `.nav-time`, `.bar-location`, `.bar-projects`, `.bar-availability`），这些元素在 `src/index.html` 中已被移除。

---

## 2. Logic Chain (推理链条)

1. **架构分裂推理**：
   - 基于观测 1 与 2，主页基于现代 ESM + Vite 构建，而画廊页被放置于 `public/` 目录且内联了 CDN Three.js r128。
   - 因此，画廊页无法得到现代构建器的代码压缩与混淆，且存在网络离线/CDN不可用导致白屏的强脆弱性。必须将其重构成 Vite 多页面应用（MPA），统一打包并复用本地 Three.js 依赖。

2. **移动端性能危机推理**：
   - 基于观测 4，首屏及画廊需要下载超过 30MB 的未压缩图片资产。
   - 在移动端网络（4G/弱网）环境下，加载 30MB 资源会导致长达数十秒的加载白屏（FCP/LCP 指标崩溃），并在移动端 GPU 上占用大量贴图显存，极易触发 WebGL Context Lost。
   - 因此，将图片全量无损/高质转换为 WebP 格式并实现适度尺寸优化是移动端适配与性能测试达标的前置决定性工作。

3. **代码健康度与运行稳定性推理**：
   - 基于观测 5，`Orchestrator.js` 存在销毁时的崩溃 Bug，`script.js` 存在无效定时器轮询，`style.css` 存在冗余样式，`gallery.html` 存在标题拼写错误。
   - 因此，在重构阶段必须对这些代码异味与隐患进行清理与修复。

---

## 3. Caveats (局限与前提)

1. **测试覆盖**：本项目目前未配置自动化测试套件（如 Jest / Vitest），验证主要基于 Vite 构建检查与静态语法分析。
2. **移动设备真机渲染差异**：部分低端移动设备对 WebGL 浮点纹理（`THREE.FloatType`）或着色器精度的支持可能有限，需在后续测试阶段通过 Chrome DevTools 移动端模拟与真机验证。
3. **只读权限约束**：本次任务为勘查阶段（Architecture Explorer），未直接对源代码进行破坏性修改，修改工作交由后续重构与实现团队执行。

---

## 4. Conclusion (勘查结论)

1. **技术栈与构建状态**：项目为原生 Vanilla JS + Three.js + Vite，当前 `npm run build` 可正常输出，但架构存在主页与画廊页的双规割裂。
2. **移动端重构关键路径**：
   - **P0: 统一打包管线**：将 `gallery.html` 移入 `src/`，通过 `vite.config.js` 配置多页面打包，消除外部 CDN 依赖。
   - **P0: 静态资源瘦身**：将全站 30MB+ 的 PNG/JPG 转换为现代化 WebP，图片体积缩减 80%~90%。
   - **P1: 移动端手势与响应式调优**：解耦主页单指涟漪与视角旋转冲突，优化画廊在小屏上的滑动阻尼与透镜展示。
   - **P1: 消除代码隐患与死代码**：修复 `Orchestrator.destroy` 异常，移除无效定时器及历史遗留样式，修正拼写。

---

## 5. Verification Method (验证方法)

1. **独立复现构建状态**：
   在项目根目录下执行：
   ```powershell
   npm run build
   ```
   预期输出：构建成功，生成 `dist/index.html` 与静态 assets，Exit Code 为 0。

2. **复现资产体积问题**：
   在终端执行：
   ```powershell
   Get-ChildItem -Recurse public | Measure-Object -Property Length -Sum
   ```
   预期输出：总大小约为 31 MB 左右。

3. **复现 Orchestrator 潜在 Bug**：
   在 Node 或浏览器控制台中实例化 `new Orchestrator()` 后调用 `orchestrator.destroy()`，可观察到 `this.camera.controls` 为 undefined 的异常。
