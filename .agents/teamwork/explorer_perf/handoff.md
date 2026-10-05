# 移动端交互与性能勘查交接报告 (handoff.md)

- **发送方角色**: Interaction & Performance Explorer
- **接收方**: 编排者 (Orchestrator) 及后续实现/优化智能体
- **完成时间**: 2026-10-05T01:21:30Z
- **勘查工作目录**: `c:\Users\石志鸿\Desktop\ivy-memories\.agents\teamwork\explorer_perf`

---

## 1. 勘查观测 (Observation)

### 1.1 静态资源观测数据
- **观测 1.1.1 (背景贴图异常)**:
  - 路径: `public/image.png`
  - 属性: 文件扩展名为 `.png`，但文件头部二进制签名为 `FF D8 FF E0`（JFIF JPEG），文件大小为 **1,965,412 字节 (~1.96 MB)**。
  - 真实分辨率: **5000 × 2812** 像素。
  - 在 `src/ThreeJS/Stage.js` 行 46 被直接载入: `this.imageTexture = textureLoader.load(`${import.meta.env.BASE_URL}image.png`);`。在 WebGL 中解压为 RGBA 格式时占用内存 `5000 * 2812 * 4` 字节 ≈ **56.24 MB** 显存。
- **观测 1.1.2 (画廊图库全量过重与预加载)**:
  - 路径: `public/img/0.png` ~ `12.png`，共 13 张 PNG 图片。
  - 统计大小: 13 张图片累计体积为 **26,827,872 字节 (~26.8 MB)**，单张图片体积在 1.52 MB 至 2.83 MB 之间。
  - 真实分辨率: 10 张为 1920×1080，3 张为 1280×720。
  - 在 `public/gallery.html` 行 335-342 被循环全量加载:
    ```javascript
    IMAGES.forEach(function(src, i) {
      var tex = textures[i] || loader.load(src, function(loaded) {
    ```
    页面初次打开即并发发出 13 个大图请求，无视口懒加载、无格式压缩、无模糊占位。
- **观测 1.1.3 (网站图标超重)**:
  - 路径: `public/favicon.jpg`，文件大小为 **304,454 字节 (~304 KB)**，在 `src/index.html` 行 7 及 `public/gallery.html` 行 7 中被作为 `<link rel="icon">` 引用。

### 1.2 WebGL 渲染管线与着色器循环观测
- **观测 1.2.1 (顶点着色器高频循环与深度通道重复)**:
  - 路径: `src/ThreeJS/Stage.js` 行 11-12、141-160、263。
  - 网格由 32×18 = 576 个 `BoxGeometry(0.8, 3, 0.8)` 实例组成（每个立方体 36 顶点，全网格 20,736 顶点）。
  - 在 `overrideVertexShader` 中:
    ```glsl
    for ( int i = 0; i < uTrailCount; i++ ) {
        vec4 td = texture2D(uTrailTexture, vec2( ( float(i) + 0.5 ) / 128.0, 0.5 ));
        ...
        waveHeight += weight * cos( uWaveFreq * relDist );
        totalWeight += weight;
    }
    ```
  - 当触摸拖动活跃时，`uTrailCount` 上限为 128。顶点着色器单帧执行 20,736 × 128 = 2,654,208 次循环。
  - 在 `Stage.js` 行 264，`this.instancedMesh.customDepthMaterial = depthMaterial;`（附带相同顶点变形），因此在阴影 pass 中再次执行一遍，单帧合计高达 **5,308,416 次** 顶点着色器循环与纹理采样。
- **观测 1.2.2 (后期处理离屏 Pass 开销)**:
  - 路径: `src/ThreeJS/Renderer.js` 行 37-49。
  - 使用了 `EffectComposer`，添加了 `RenderPass`、`ShaderPass(VignetteRGBShiftShader)` 和 `OutputPass`。
  - 每帧需要进行 3 次全屏 RenderTarget 的读写与渲染切换，在手机 Retina 屏（DPR=2，`Sizes.js` 行 12 限制）下对移动端 TBDR 架构造成严重填充率瓶颈。
- **观测 1.2.3 (画廊双渲染器实例化)**:
  - 路径: `public/gallery.html` 行 235 (`renderer = new THREE.WebGLRenderer(...)`) 与 行 647 (`lensRenderer = new THREE.WebGLRenderer(...)`)。
  - 页面上存在两个独立的 WebGLRenderer 实例与 Canvas，同时持有独立的 WebGLContext。

### 1.3 移动端触摸交互观测
- **观测 1.3.1 (单指拖动视角与波纹生成强冲突)**:
  - 路径: `src/ThreeJS/Camera.js` 行 63-81 监听 `pointermove` 累加视角旋转；`src/ThreeJS/Effects/MouseTrail.js` 行 146-176 同样监听 `pointermove` 采集波纹点。
  - 单指在屏幕上滑动以观察 3D 模型时，两个逻辑同时响应，视角旋转伴随剧烈的非预期水波扩散，并迅速填满 128 个轨迹点。
- **观测 1.3.2 (透镜中心遮挡手指与退出困难)**:
  - 路径: `public/gallery.html` 行 690-699 (`moveLens`)。
  - `lensMouse` 计算完全对齐指针物理坐标，在手机触屏上，放大的内容恰好位于用户大拇指下方，视觉内容被手指完全遮挡。
  - 退出依赖右上角小关闭按钮 (`#lensCloseBtn`)，无下滑关闭手势。
- **观测 1.3.3 (移动端点击高亮遮罩缺失防范)**:
  - 全局 CSS (`src/style.css`, `public/gallery.html`) 未设置 `-webkit-tap-highlight-color: transparent;`。

### 1.4 本地运行基准测试观测
- **观测 1.4.1 (Lighthouse 初始实测结果)**:
  - 运行命令: `npx vite preview --port 4173 --host 127.0.0.1` 配合 Chrome 128+ Lighthouse Mobile 审计。
  - 首页 (`/`): Performance **43 分**, FCP **13.1s**, LCP **18.8s**, TBT **490ms**, CLS **0**, 资源传输 **4,243 KiB**。
  - 画廊页 (`/gallery.html`): Performance **41 分**, FCP **12.4s**, LCP **12.4s**, TBT **580ms**, CLS **0**, 资源传输 **29,181 KiB (~29.2 MB)**。

---

## 2. 推理逻辑链 (Logic Chain)

1. **资源超重导致首屏崩溃 (支撑自 1.1.1, 1.1.2, 1.1.3, 1.4.1)**:
   - 移动端 4G 模拟网络平均下载速率约为 1.6 MB/s。首页传输 4.2 MB 资源至少耗费 2.6 秒纯网络传输；画廊页传输 29.2 MB 则耗费超过 18 秒。
   - 这直接导致 Lighthouse 测出的 FCP 和 LCP 飙升至 12s~18s，拉低性能得分至 41~43 分。
   - `image.png` 真实分辨率 5000×2812 远超 32×18 立方体采样的精度需求，不仅消耗网络，更霸占 56 MB 显存，老旧设备（`MAX_TEXTURE_SIZE` 为 4096）存在着色器采样崩溃风险。
2. **WebGL 管线过重引发移动端掉帧与发热 (支撑自 1.2.1, 1.2.2, 1.2.3)**:
   - 移动 GPU 核心数少且显存带宽有限。单帧 530 万次顶点着色器循环 + 3 次离屏全屏 RenderPass + 实时 1024 阴影贴图，在移动端是典型的算力超配。
   - `EffectComposer` 的轻微色差对小屏幕观感增益微乎其微，却剥夺了硬件直接上屏的性能优势。
   - 画廊页双 WebGLRenderer 增加显存开销并在多任务切换时极易发生上下文丢失。
3. **触摸交互未对移动场景解耦 (支撑自 1.3.1, 1.3.2, 1.3.3)**:
   - 桌面端鼠标 hover 与点击拖动界限清晰，而移动端只有 `touch`。将桌面端 mousemove 逻辑直接映射为 pointermove，必然导致视角旋转与波纹产生的误触与冲突。
   - 触控放大的物理人机工效学要求视心避开指尖遮挡，当前 1:1 坐标对齐导致功能失效。

---

## 3. 限制与假设 (Caveats)

1. **未在真机物理设备上测试温度与长时电池衰减**: 当前数据基于 PC 上的 Chrome Headless 移动端节流模拟（Mobile Throttling 4x CPU Slowdown），虽然标准准确，但不同 Android 芯片（如低端联发科/高通）的实际 WebGL 驱动表现可能存在细微差异。
2. **未对当前业务代码作任何破坏性修改**: 本勘查遵循只读规范，未改动 `src/` 或 `public/` 源码，一切数据均为现有代码客观基准值。
3. **未引入外部未授权第三方库**: 方案建议优先使用现代浏览器原生能力（WebP 格式、CSS 滤镜、原生手势算法），无需引入臃肿的大型外部手势库。

---

## 4. 勘查结论 (Conclusion)

必须立即在后续重构中实施以下四项核心优化（均已形成具体可落地路径）：
1. **静态资产现代格式轻量化**:
   - 将 `image.png` 压制为 1024×576 WebP（体积从 1.96MB 降至 ~100KB）。
   - 将画廊 13 张 PNG 压制为 1920×1080 WebP，并提供 40×24 微型模糊占位图（LQIP），体积从 26.8MB 降至 ~2.3MB。
   - 将 Favicon 替换为轻量 SVG/PNG 图标。
2. **移动端 WebGL 渲染管线自适应降级**:
   - 移动端检测生效时，绕过 `EffectComposer`，采用直接渲染；暗角改用 CSS 蒙版。
   - 限制移动端波纹轨迹点数量（`MAX_TRAIL` 降至 32-48）；移动端降低阴影贴图精度或关闭动态阴影。
   - 画廊系统合并为单一 `WebGLRenderer`，消除双上下文风险。
3. **触控交互体验与人机工效重构**:
   - 区分“轻触激起波纹”与“拖拽平滑旋转视角”。
   - 画廊滑动增加速度阻尼衰减与**最近卡片磁吸居中 (Snap-to-center)**。
   - 透镜交互增加 Y 轴偏置（Touch Offset 60px），解决手指遮挡，并支持下滑退出。
   - 全局补齐 `-webkit-tap-highlight-color: transparent;` 与按钮 `:active` 缩放微反馈。
4. **性能监测闭环**:
   - 配置标准化测试脚本，重构后再次执行 Lighthouse Mobile 审计，目标性能分达到 **85 分以上**，LCP 降至 **2.5s 以内**。

---

## 5. 独立验证方法 (Verification Method)

后续代理或开发人员可通过以下命令独立复现并验证本报告的所有观测与结论：

1. **项目构建与服务启动**:
   ```powershell
   pnpm install
   pnpm build
   npx vite preview --port 4173 --host 127.0.0.1
   ```
2. **复现首页移动端 Lighthouse 审计**:
   ```cmd
   cmd.exe /c "set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe && npx -y lighthouse http://127.0.0.1:4173/ --chrome-flags=\"--headless=new --no-sandbox --disable-extensions\" --preset=mobile --output=json --output-path=.agents/teamwork/explorer_perf/verify_index.json --quiet"
   ```
   *预期验证结果*: 性能得分约 43 分，LCP > 15s，提示 `total-byte-weight` 过大。
3. **复现画廊页资源过重审计**:
   ```cmd
   cmd.exe /c "set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe && npx -y lighthouse http://127.0.0.1:4173/gallery.html --chrome-flags=\"--headless=new --no-sandbox --disable-extensions\" --preset=mobile --output=json --output-path=.agents/teamwork/explorer_perf/verify_gallery.json --quiet"
   ```
   *预期验证结果*: 传输量约为 29 MB，性能得分约 41 分。
4. **图片分辨率与文件头验证**:
   ```powershell
   node -e "const fs = require('fs'); const b = fs.readFileSync('public/image.png'); console.log('Magic:', b.slice(0, 4).toString('hex')); for(let i=0; i<b.length-10; i++){ if(b[i]===0xFF && (b[i+1]===0xC0||b[i+1]===0xC2)){ console.log('Resolution:', b.readUInt16BE(i+7) + 'x' + b.readUInt16BE(i+5)); break; } }"
   ```
   *预期验证结果*: Magic 输出 `ffd8ffe0`，Resolution 输出 `5000x2812`。
