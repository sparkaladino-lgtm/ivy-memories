# 移动端交互体验与渲染性能深度勘查报告 (analysis.md)

- **勘查角色**: Interaction & Performance Explorer
- **项目名称**: ivy-memories (3d-wave-grid)
- **勘查日期**: 2026-10-05
- **环境信息**: Windows 11 / Node.js v26.10.0 / pnpm 12.8.1 / Vite 8.0.13 / Chrome 128+

---

## 1. 勘查概览与核心基准性能数据 (Executive Summary)

针对项目在移动设备上的交互顺畅度与渲染性能进行了系统性实测与源码追踪。在本地生产环境构建（`pnpm build` + `vite preview` 端口 4173）下，使用 Lighthouse Mobile（模拟低端移动设备 Moto G4，4x CPU 节流，4G 弱网模拟）对首页及画廊页进行了基准审计：

### 1.1 初始性能基准实测表 (Baseline Metrics)

| 页面 | Lighthouse 性能得分 | FCP (首次内容绘制) | LCP (最大内容绘制) | TBT (总阻塞时间) | CLS (布局偏移) | 传输体积 (Byte Weight) | 评级 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **首页 (`/`)** | **43 / 100** | 13.1 s | 18.8 s | 490 ms | 0.00 | 4.24 MB (4,243 KiB) | **极低 (红区)** |
| **画廊页 (`/gallery.html`)** | **41 / 100** | 12.4 s | 12.4 s | 580 ms | 0.00 | 29.18 MB (29,181 KiB) | **严重超重 (红区)** |

### 1.2 核心瓶颈总结
1. **静态资源灾难性过大**: 画廊页 13 张照片均为无压缩 PNG，全量直接预加载，总计 **26.8 MB**；首页背景贴图表面为 `image.png`，实际为 **5000×2812** 像素的超高分辨率 JPEG，体积 **1.96 MB**，仅此一项在手机 GPU 中解压占用 **56 MB+** 显存；Favicon 竟高达 **304 KB**。
2. **WebGL 顶点着色器循环严重超负荷**: `Stage.js` 顶点着色器对 576 个 Cube 的每个顶点执行每帧多达 128 次的轨迹迭代与高斯/三角函数运算，加上实时阴影 Pass，单帧顶点计算高达 **530 万次**循环。
3. **低收益高开销的后期处理 (Post-Processing)**: 首页采用 `EffectComposer` 进行全屏双通道渲染（Vignette + RGB 色差），在手机 DPR=2 的屏幕上每帧触发 3 次全屏贴图绘制与 Framebuffer ping-pong 切换，对移动端 TBDR 架构极度不友好。
4. **画廊页双 WebGL 上下文隐患**: 画廊页主画廊与放大镜（Lens Overlay）各实例化了一个 `THREE.WebGLRenderer`，在移动浏览器（尤其是 iOS Safari）易触发 WebGL 上下文丢失或闪退。
5. **触摸交互细节欠缺**: 视角拖拽与波纹手势强耦合冲突；画廊滑动缺少卡片磁吸（Snap）；透镜在触屏上被手指完全遮挡；缺乏触控反馈（Feedback）与下滑关闭手势。

---

## 2. 动画与视觉特效渲染性能勘查 (Animations & WebGL/Shaders)

### 2.1 首页 3D 网格着色器开销 (`src/ThreeJS/Stage.js`, `MouseTrail.js`)
- **源码定位**:
  - `src/ThreeJS/Stage.js` 行 11-12 (`gridCols = 32`, `gridRows = 18`)，共 576 个立方体实例。
  - `src/ThreeJS/Stage.js` 行 141-160 (`overrideVertexShader` 顶点着色器循环):
    ```glsl
    for ( int i = 0; i < uTrailCount; i++ ) {
        vec4 td = texture2D(uTrailTexture, vec2( ( float(i) + 0.5 ) / 128.0, 0.5 ));
        float dist = length( worldXZ - td.rg );
        float wavefront = uWaveSpeed * td.b;
        float relDist = dist - wavefront;
        float window = exp( -( relDist * relDist ) / ( uWaveWidth * uWaveWidth ) );
        float fade = exp( -td.b / uFadeTime );
        float atten = 1.0 / ( 1.0 + dist * 0.1 );
        float weight = fade * window * atten * td.a;
        waveHeight += weight * cos( uWaveFreq * relDist );
        totalWeight += weight;
    }
    ```
- **性能开销分析**:
  - 每个立方体由 `BoxGeometry` 构成，包含 36 个顶点。576 个实例共 20,736 个顶点。
  - 当鼠标/触控在屏幕上快速滑动，`uTrailCount` 迅速达到上限 128。
  - 20,736 顶点 × 128 次循环 = **2,654,208 次/帧** 的顶点纹理采样与指数/三角计算。
  - **阴影 Pass 翻倍**: 在 `Stage.js` 行 243-264，`instancedMesh.customDepthMaterial` 挂载了完全一致的变形着色器，因此渲染阴影贴图时上述循环还要再跑一次！单帧顶点计算量达到 **5,308,416 次**。
  - 在移动端低功耗 GPU 上，顶点着色器的纹理抓取（VTF: Vertex Texture Fetch）开销极大，容易引发管线停顿与严重掉帧。
- **优化建议**:
  - 针对移动端（`isTouch` 或 `width < 768`），降低网格密集度（如 24×14，由 576 缩至 336 个实例）。
  - 将移动端波纹轨迹点上限 `MAX_TRAIL` 从 128 限制为 32 或 48，或对静止已衰减的点进行早期 break。
  - 移动端可关闭动态阴影计算（`directionalLight.castShadow = false`），直接节省一半的顶点运算和 1024×1024 离屏贴图渲染。

### 2.2 后期处理管线分析 (`src/ThreeJS/Renderer.js`, `VignetteRGBShiftShader.js`)
- **源码定位**:
  - `src/ThreeJS/Renderer.js` 行 36-49:
    ```javascript
    this.composer = new EffectComposer(this.instance);
    this.renderPass = new RenderPass(this.scene, this.camera.instance);
    this.composer.addPass(this.renderPass);
    this.vignetteRGBShiftPass = new ShaderPass(VignetteRGBShiftShader);
    this.composer.addPass(this.vignetteRGBShiftPass);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
    ```
- **性能开销分析**:
  - 移动设备普遍采用瓦片式延迟渲染架构（Tile-Based Deferred Rendering, TBDR）。频繁切换离屏 `RenderTarget` 会导致频繁的瓦片显存与系统内存间的 Dump 与 Reload，严重损耗显存带宽并急剧增加电池发热。
  - 在设备像素比为 2（Retina 屏）的情况下，780×1688 的屏幕尺寸对应 132 万物理像素。3 次 Pass 相当于每帧执行近 400 万次片元着色。
  - 该 Pass 仅产生了极其轻微的色差（`shiftAmount = 0.005`）和边缘暗角，在 6 英寸手机屏幕上肉眼几不可见。
- **优化建议**:
  - **移动端完全绕过 EffectComposer**: 在移动设备检测生效时，直接调用 `this.instance.render(this.scene, this.camera.instance)`。
  - 暗角效果（Vignette）完全可以通过在页面上方覆盖一个带有 `pointer-events: none` 的 CSS `radial-gradient` 蒙版层实现，GPU 渲染开销降为 0！

### 2.3 画廊双 WebGL 渲染器隐患 (`public/gallery.html`)
- **源码定位**:
  - `public/gallery.html` 行 235: 主画廊 `new THREE.WebGLRenderer({ antialias: true, alpha: true })`
  - `public/gallery.html` 行 647: 透镜系统 `new THREE.WebGLRenderer({ antialias: true, alpha: true })`
- **性能与稳定性风险**:
  - 页面上并存两个 WebGLRenderer。点击放大照片时，两个 Canvas 同时挂载并分配各自的上下文与 Framebuffer。
  - 移动端 WebKit / Chrome 对同时活动的 WebGL 上下文数量有严格硬限制（通常上限为 8-16 个，在内存紧张时甚至降至更低）。双上下文会成倍挤占 VRAM，在部分移动设备上极易触发 `webglcontextlost` 导致黑屏或网页崩溃。
- **优化建议**:
  - 统一复用同一个 `WebGLRenderer` 和同一个全屏 `<canvas>`，通过场景切换（`sceneGallery` 与 `sceneLens`）或正交相机全屏渲染切换，避免创建多个渲染器。

### 2.4 常驻渲染循环与功耗优化
- **问题**: `src/ThreeJS/Orchestrator.js` 和 `public/gallery.html` 均采用无条件 60fps/120fps 动画渲染循环。用户静置手机 5 分钟，GPU 仍然 100% 满频运行，导致手机严重发热掉电。
- **优化建议**:
  - 引入**动态脏渲染检测 (Dirty Rendering / Idle Sleep)**：当近 3 秒内无触摸交互、波纹活跃点为 0、摄像机平滑插值差值 `< 0.0001` 时，停止向 GPU 提交 draw call，仅在触发 pointer 事件或动画时唤醒。

---

## 3. 移动端触摸交互支持勘查 (Touch Interactions & UX)

### 3.1 单指滑动冲突：视角旋转 vs 波纹产生
- **源码定位**:
  - `src/ThreeJS/Camera.js` 行 63-81 (`pointermove` 改变 `mouse.x`, `mouse.y`)
  - `src/ThreeJS/Effects/MouseTrail.js` 行 146-176 (`pointermove` 采集波纹点)
- **现存问题**:
  - 当用户在手机上尝试单指拖动以旋转 3D 视角时，手指滑动同时被 `MouseTrail` 捕获，沿途疯狂生成密集的波纹点。
  - 结果：用户仅仅想看一眼侧面，却激起满屏剧烈震荡的波纹；同时在 1 秒内将 128 个轨迹点填满，加剧 GPU 渲染压力。
- **优化建议**:
  - **交互意图分流**:
    - 点击（Tap, 移动距离 < 10px）: 触发单次强力水滴波纹。
    - 快速拖动（Drag, 速度或位移达到阈值）: 专职用于 3D 摄像机平滑轨道旋转，抑制或大幅降低波纹生成频率（增大 `trailSpacing`）。

### 3.2 双指捏合缩放 (Pinch-to-Zoom) 体验
- **源码定位**: `src/ThreeJS/Camera.js` 行 67-75:
  ```javascript
  if (this.pointers.size === 2) {
      const distance = pinchDistance();
      if (this.pinchStart > 0 && distance > 0) {
          this.zoom = THREE.MathUtils.clamp(this.zoom * this.pinchStart / distance, 0.8, 1.6);
          this.radius = this.fitRadius * this.zoom;
      }
      this.pinchStart = distance;
      return;
  }
  ```
- **现存问题**:
  - 每次 pointermove 直接重置 `this.pinchStart = distance`，在两指微动时极易产生数值抖动，且缩放缺少类似摄像机位置的 `lerp` 阻尼滤波，导致移动端捏合缩放体感生硬。
- **优化建议**: 为 `zoom` 引入平滑阻尼目标值 `targetZoom`，在每帧 `update` 中平滑过渡。

### 3.3 画廊滑动阻尼与卡片磁吸对齐 (`public/gallery.html`)
- **源码定位**: `public/gallery.html` 行 477-486 (惯性滑动公式)
- **现存问题**:
  - 滑动停下时，照片位置完全取决于手指离手瞬间的微弱速度，经常停止在两张照片各露一半的非居中状态。
- **优化建议**:
  - 引入**磁吸对齐 (Snap-to-Item)**：当速度衰减到阈值（如 `< 0.05`）且无拖拽时，自动将最近的一张照片平滑磁吸居中对齐到视口中央。
  - 增加触摸滚动阻尼（Overscroll Damping）与动量体验。

### 3.4 移动端透镜（放大镜）的手指遮挡问题 (`public/gallery.html`)
- **源码定位**: `public/gallery.html` 行 690-699 (`moveLens` 事件)
- **现存问题**:
  - 透镜渲染中心与触点完全重合：在电脑上用鼠标看很自然，但在手机上用户的大拇指直接按在放大区域上方，**手指直接挡住了被放大的图像内容**！
  - 退出机制差：全屏透镜弹出后，用户在移动端只能去寻找右上角的较小关闭按钮；手机上没有 ESC 键，用户习惯性的“下滑返回”或“双击返回”均未支持。
- **优化建议**:
  - **触屏偏置 (Touch Offset)**：在触摸设备上，放大中心向上偏置（例如向上偏移 60-80px 或 0.15 归一化单位），使得放大的细节清晰显露在手指上方。
  - **多维手势退出**: 增加全屏下滑手势退出（Swipe Down to Dismiss）及点击背景空白区域退出。

### 3.5 触控高亮与反馈
- **现存问题**:
  - 缺少 `-webkit-tap-highlight-color: transparent`，在 Android Chrome 上点击文字与按钮会出现原生浅灰遮罩。
  - 按钮与交互元素缺少 `:active` 缩放反馈与轻微振动反馈（`navigator.vibrate?.(10)`）。

---

## 4. 图片与多媒体静态资源加载策略勘查 (Media & Static Assets)

### 4.1 核心媒体资产详查清单

| 资产路径 | 声明格式 | 实际格式 / 编码 | 分辨率 | 文件大小 | 解码后 VRAM 预估 | 评估与严重程度 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `public/image.png` | PNG | **JPEG (JFIF)** | **5000 × 2812** | **1.96 MB** | **56.2 MB** | 🚨 **严重事故级别**: 伪装格式，分辨率严重超配，老旧设备面临 4096 纹理超限报错 |
| `public/favicon.jpg` | JPEG | JPEG | 600+ px | **304.5 KB** | ~1.5 MB | ⚠️ **异常超大**: 作为 Favicon 应小于 5 KB |
| `public/img/0.png` ~ `12.png` (13张) | PNG | PNG | 1920×1080 / 1280×720 | **26.8 MB** (单张 1.5M-2.8M) | 每张 **8.3 MB**，总计 **108 MB** | 🚨 **严重灾难**: 移动端首屏一次性并发下载 27MB 无压缩大图，带宽与显存瞬间被打爆 |

### 4.2 具体优化方案与收益预估
1. **`image.png` 重构方案**:
   - 当前用途仅为 32×18 个立方体的表面网格贴图采样。
   - 裁切与压缩为 **1024×576** 或 **1920×1080** 的 WebP 格式（品质 82）。
   - 文件体积可从 **1.96 MB 骤降至 80~120 KB**（缩减 **94%**），显存占用从 **56 MB 降至 2.3 MB**！
2. **画廊 13 张照片的现代压缩与懒加载方案**:
   - **格式转换**: 将全部 PNG 转为现代 WebP 格式（75-80% 视觉无损压缩），单张体积从 2MB 降至 150-220 KB，13 张总大小从 **26.8 MB 降至 2.3 MB**（减少 **91%** 传输量）。
   - **视口按需懒加载 (Lazy Texture Loading)**:
     - 初始仅加载屏幕中央可见的 3 张照片纹理。
     - 随着用户滑动，提前 1 屏动态加载后续纹理。
   - **低清占位图 (LQIP - Low Quality Image Placeholder)**:
     - 生成 13 张 40×24 像素的极微缩 WebP（单张仅 800 字节，总共 10 KB）。
     - 页面秒开即显示柔和的模糊毛玻璃占位，高清贴图加载完毕后平滑 `opacity` 淡入。
3. **Favicon 瘦身**:
   - 替换为 32×32 或 48×48 SVG / PNG 图标，体积控制在 2-4 KB。

---

## 5. 本地环境性能检测工具运行评估与可执行脚本 (Performance Tooling)

### 5.1 本机环境执行条件验证
- **操作系统**: Windows 11
- **Node.js**: v26.10.0 (支持最新原生 fetch 及 ES Module)
- **包管理器**: pnpm 12.8.1
- **已安装浏览器**: Google Chrome 位于 `C:\Program Files\Google\Chrome\Application\chrome.exe`
- **本地服务支持**: Vite 8.0.13 支持以 `vite preview` 或 `vite dev` 启动本地高速静态服务器。

### 5.2 性能测试建议执行脚本 (CLI / Package.json)

为确保在后续代码重构中和完成后能快速、客观地进行移动端性能检测，建议在 `package.json` 的 `scripts` 中增加以下专用测试命令：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4173 --host 127.0.0.1",
    "perf:audit:mobile": "cmd.exe /c \"set CHROME_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe && npx -y lighthouse http://127.0.0.1:4173/ --chrome-flags=\\\"--headless=new --no-sandbox --disable-extensions\\\" --preset=mobile --output=json,html --output-path=./perf-reports/mobile_index --quiet\"",
    "perf:audit:gallery": "cmd.exe /c \"set CHROME_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe && npx -y lighthouse http://127.0.0.1:4173/gallery.html --chrome-flags=\\\"--headless=new --no-sandbox --disable-extensions\\\" --preset=mobile --output=json,html --output-path=./perf-reports/mobile_gallery --quiet\""
  }
}
```

### 5.3 自动化轻量性能巡检脚本设计 (Playwright / Puppeteer 方案)
除了静态审计 Lighthouse，针对 3D WebGL 项目，FPS（帧率）与 GPU 显存稳定性测试同样关键。建议后续可编写一个轻量 node 测试脚本 `scripts/perf-fps-check.mjs`：
```javascript
// 基于 Chrome DevTools Protocol 采集 10 秒交互帧率
import puppeteer from 'puppeteer-core';

async function testFPS() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:4173/');
  
  // 模拟触摸拖动操作并采集 requestAnimationFrame 帧间隔
  const fpsData = await page.evaluate(async () => {
    return new Promise(resolve => {
      let frames = 0;
      const start = performance.now();
      function loop() {
        frames++;
        if (performance.now() - start < 3000) requestAnimationFrame(loop);
        else resolve((frames / 3).toFixed(1));
      }
      requestAnimationFrame(loop);
    });
  });
  console.log(`平均移动端 FPS: ${fpsData} fps`);
  await browser.close();
}
```

---

## 6. 交互与性能优化路线规划图 (Roadmap & Action Items)

| 阶段 | 模块 | 具体行动项 | 预期效果 |
| :--- | :--- | :--- | :--- |
| **P0 (立刻执行)** | **媒体资源压缩** | 1. 将 `image.png` 转为 1024 宽 WebP；<br>2. 将画廊 13 张 PNG 转为 WebP；<br>3. 替换 304KB Favicon | 传输量骤降 **90%+** (30MB -> 2.5MB)，首屏 LCP 缩短至 2 秒内 |
| **P0 (立刻执行)** | **后期处理精简** | 移动端绕过 `EffectComposer`，使用直接渲染；改用 CSS 渐变模拟暗角 | 节省 3 次全屏贴图 Pass，消除 TBDR 瓶颈，FPS 显著提升 |
| **P1 (核心优化)** | **WebGL 顶点减负** | 1. 移动端限制 `MAX_TRAIL` 至 32；<br>2. 移动端禁用或降级实时动态阴影；<br>3. 移动端适度减少网格密度 | 单帧顶点运算循环从 530 万次降至 40 万次以下 |
| **P1 (核心优化)** | **画廊多上下文收敛** | 消除 `gallery.html` 中的第二 WebGLRenderer，统一步调与场景切换 | 杜绝移动端 WebGL 上下文溢出闪退风险 |
| **P2 (体验增强)** | **移动端手势重构** | 1. 区分轻触波纹与视角旋转；<br>2. 画廊滑动引入磁吸 Snap 与阻尼；<br>3. 透镜交互增加触控 Y 轴偏置防遮挡；<br>4. 增加下滑返回手势与点击反馈 | 触控体验符合现代移动端交互最佳实践 |
| **P2 (体验增强)** | **空闲节流休眠** | 场景静置 3 秒后停止提交 draw call，触控时唤醒 | 彻底解决手机常驻发热与电池快速消耗问题 |
