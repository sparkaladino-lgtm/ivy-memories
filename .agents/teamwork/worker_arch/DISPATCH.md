# DISPATCH — worker_arch

- Milestone: M2_ARCH
- Role: Build & Architecture Worker
- Working Directory: c:\Users\石志鸿\Desktop\ivy-memories\.agents\teamwork\worker_arch
- Project Root: c:\Users\石志鸿\Desktop\ivy-memories
- Scope Document: c:\Users\石志鸿\Desktop\ivy-memories\PROJECT.md
- Original Request: c:\Users\石志鸿\Desktop\ivy-memories\.agents\teamwork\ORIGINAL_REQUEST.md
- Write Ownership: `vite.config.js`, `package.json`, `src/ThreeJS/Orchestrator.js`, `src/script.js`, `src/index.html`, `src/gallery.html` (严禁越权修改其他文件)

## 任务目标
1. 架构统一与多页面配置（MPA）：
   - 目前 `public/gallery.html` 孤立在 `public/` 目录下，且引用了外部 CDN `Three.js r128`，无法离线运行且脱离现代打包；
   - 将画廊页面重构为现代多页面模块（可将画廊页面组织为 `src/gallery.html`，配置 `vite.config.js` 的 `build.rollupOptions.input` 支持多入口：`main: 'src/index.html'`, `gallery: 'src/gallery.html'`）；
   - 画廊页面内部的三维与动效依赖统一使用本地 npm 安装的 `three` 等模块（ESM import），彻底移除对外部 cdnjs 的硬编码依赖；
   - 保持主页到画廊页的跳转链接有效平滑（如 `href="./gallery.html"`）；
2. 消除代码运行隐患与崩溃 Bug：
   - 修复 `src/ThreeJS/Orchestrator.js` 行 102 的空指针报错：检查 `this.camera.controls` 是否存在再调用 `dispose()`；
   - 清理 `src/script.js` 中的无效定时器：移除试图查找 `#local-time` 元素的 `updateTime()` 定时器；
   - 修复画廊页面标题拼写错误：`<title>Ivy Lawon</title>` 修正为 `<title>Ivy Lawson - Gallery</title>`；
3. 验证构建：
   - 运行 `npm run build`，确保构建 Exit Code 0，多页面全部正常生成在 `dist/`，无任何语法错误与死链接；
4. 在工作目录下产出详尽的 `handoff.md`。

## 诚信规范
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
