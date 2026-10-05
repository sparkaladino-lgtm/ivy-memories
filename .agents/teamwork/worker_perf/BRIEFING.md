# BRIEFING — 2026-10-05T01:45:00Z

## Mission
优化 ThreeJS 渲染管线性能（Stage.js 与 Renderer.js），支持 WebP 纹理加载、移动端着色器循环与轨迹点自适应降级、设备像素比上限限制以及移动端直出渲染与 CSS 滤镜回退，彻底解决移动端显存带宽挤占和发热掉帧。

## 🔒 My Identity
- Archetype: WebGL & Rendering Performance Worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\石志鸿\Desktop\ivy-memories\.agents\teamwork\worker_perf
- Original parent: 8344236e-9330-44c3-863c-8630127a306b
- Milestone: M5_PERF_PIPELINE

## 🔒 Key Constraints
- 独占写权限仅限于 `src/ThreeJS/Stage.js` 和 `src/ThreeJS/Renderer.js`，严禁越权修改其他项目文件。
- 不得硬编码假数据或作弊实现。所有实现必须真实可靠。
- 必须遵循项目代码风格并确保 `npm run build` 成功。

## Current Parent
- Conversation ID: 8344236e-9330-44c3-863c-8630127a306b
- Updated: 2026-10-05T01:45:00Z

## Task Summary
- **What to build**:
  1. `src/ThreeJS/Stage.js`: 优先加载 `image.webp` (180KB) 回退 `image.png`；移动端轨迹点采样上限由 128 自适应降为 32，顶点着色器循环次数暴降 75%；深度 pass 顶点着色器上限进一步降为 16 并精简哈希抖动运算；移动端阴影贴图尺寸优化为 512x512；
  2. `src/ThreeJS/Renderer.js`: 限制 pixelRatio 最大为 2 (`Math.min(window.devicePixelRatio || 1, 2)`)；移动端支持自适应轻量直出模式（跳过多重离屏 EffectComposer pass），通过现代轻量 CSS 蒙版呈现 RGB 色差与暗角，保障 60FPS；桌面端保留全功能后期通道与 GUI 控件。
- **Success criteria**:
  - WebP 优先加载与 PNG 优雅回退；
  - 移动端单帧着色器循环次数暴降 60%~75%+；
  - pixelRatio 控制在 <= 2；
  - 移动端跳过 EffectComposer 多重离屏 Pass，启用直出模式和 CSS 蒙版；
  - `npm run build` 编译打包无错误。
- **Interface contracts**: PROJECT.md
- **Code layout**: PROJECT.md

## Key Decisions Made
- 纹理加载：使用 `TextureLoader` 异步优先请求 `image.webp`，在 `onError` 回调中自动加载 `image.png` 并热更新材质 uniform。
- 顶点着色器调优：在着色器注入 `#define MAX_TRAIL_STEPS` 宏常数（移动端主 pass 32、深度 pass 16，桌面端 128），并在 GLSL 内部使用 `min(uTrailCount, MAX_TRAIL_STEPS)` 与静态边界循环，结合 JS 层的 `uTrailCount` 裁剪，彻底解决移动端 GPU 循环发热与掉帧。
- 深度 pass 优化：移动端阴影贴图尺寸由 1024x1024 降为 512x512，深度顶点计算省去高频哈希抖动，顶点采样步数缩减至 16。
- 移动端渲染管线降级：检测 `(pointer: coarse)` 与窄屏，自动切换为直出渲染 `instance.render(scene, camera)`；动态挂载 CSS 径向渐变及轻微内外色晕蒙版，以零 GPU 着色器带宽实现暗角与色差；桌面端保留 `EffectComposer` 完整后处理通道。

## Artifact Index
- DISPATCH.md — 任务指派说明
- progress.md — 执行进度与心跳记录
- BRIEFING.md — 当前上下文与状态
- handoff.md — 完工交接报告

## Change Tracker
- **Files modified**:
  - `src/ThreeJS/Stage.js`: WebP 优先与 PNG 回退、移动端 32 步轨迹采样限制、顶点着色器宏与深度 pass 顶点优化、512x512 移动端阴影贴图。
  - `src/ThreeJS/Renderer.js`: DPR 限制 <= 2、移动端自适应轻量直出渲染管线、轻量 CSS 蒙版呈现色差/暗角、桌面端全功能 EffectComposer 通道与 GUI 调试面板。
- **Build status**: `npm run build` PASS (built in 442ms)
- **Pending issues**: 无

## Quality Status
- **Build/test result**: 通过 (dist/index.html & dist/gallery.html 打包成功)
- **Lint status**: 语法检测通过
- **Tests added/modified**: 生产构建验证通过
