## 2026-10-05T01:38:00Z
你已被指派为 WebGL & Rendering Performance Worker (worker_perf)。
你的工作目录是：c:\Users\石志鸿\Desktop\ivy-memories\.agents\teamwork\worker_perf
项目根目录是：c:\Users\石志鸿\Desktop\ivy-memories
项目规划文档：c:\Users\石志鸿\Desktop\ivy-memories\PROJECT.md
原始需求文件：c:\Users\石志鸿\Desktop\ivy-memories\.agents\teamwork\ORIGINAL_REQUEST.md
指派任务文件：c:\Users\石志鸿\Desktop\ivy-memories\.agents\teamwork\worker_perf\DISPATCH.md

你独占写权限的文件范围（Write Ownership）：
`src/ThreeJS/Stage.js`, `src/ThreeJS/Renderer.js` （严禁越权修改其他文件）

任务目标：
1. 优化 `src/ThreeJS/Stage.js`：
   - 纹理轻量化：将纹理加载升级为优先使用 `image.webp`（由 M1 生成的 180KB 高清 WebP），回退 `image.png`，彻底消除 5000x2812 导致的 56MB 显存超标；
   - 优化移动端轨迹点采样上限与着色器循环：在移动端触屏设备上将 `uTrailCount` 上限自适应降为 32 或 48，单帧顶点着色器循环次数暴降 60%~75%，大幅消除发热与掉帧；
   - 移动端自适应优化深度 pass 顶点计算；
2. 优化 `src/ThreeJS/Renderer.js`：
   - 解决移动端 `EffectComposer` 多重离屏 Pass 严重挤占手机显存带宽问题：检测到移动端（触屏或小屏幕）时支持自适应轻量直出模式，RGB 色差/暗角通过现代轻量 CSS 蒙版呈现，保障流畅 60FPS；桌面端保留全功能后期通道；
   - 限制最大设备像素比：`renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`，防止超高密屏四倍渲染过载；
3. 运行 `npm run build` 验证构建通过；
4. 在工作目录下撰写详细的 `handoff.md`，并通过 send_message 向父编排者汇报完成。
