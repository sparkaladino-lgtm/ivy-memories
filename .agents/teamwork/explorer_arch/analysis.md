# ivy-memories 项目架构与技术栈勘查分析报告 (analysis.md)

- **勘查日期**：2026-10-05
- **勘查人员**：Architecture Explorer
- **项目根路径**：`c:\Users\石志鸿\Desktop\ivy-memories`
- **当前 Git 分支**：`main` (最新提交: `8aa5cfa Remove incompatible restart plugin to fix Pages dependency installation`)

---

## 1. 项目定位与业务背景

`ivy-memories`（原名 `3d-wave-grid`）是一个高品质、强交互的 WebGL 3D 视觉展示与个人回忆画廊网站。
网站整体包含两个核心体验场景：
1. **主页（Index）**：基于 Three.js + 自定义 GLSL 顶点位移着色器的 3D 互动波纹网格，由 576 个立方体组成，映射角色/主题贴图，响应用户的鼠标/触控轨迹产生水波涟漪并支持三维视角漫游。
2. **画廊页（Gallery / My Memory）**：波浪形流体照片画廊，展示 13 张高清回忆照片，支持横向阻尼滑动，并可点击照片进入全屏“透镜模式”（Lens Overlay），通过自定义着色器实现凸透镜扭曲、色散（RGB Shift）与水波扰动。

---

## 2. 技术栈与环境配置

| 类别 | 技术/工具 | 版本 | 作用说明 |
| :--- | :--- | :--- | :--- |
| **运行时环境** | Node.js | v22 (CI 设定) | 本地构建与自动化部署环境 |
| **包管理工具** | npm / pnpm | 支持两者 (含 package-lock / pnpm-lock) | 依赖管理 |
| **构建打包器** | Vite | `^8.0.13` (实际安装 `8.3.2`) | 前端轻量高速构建工具 |
| **前端架构** | 原生 JavaScript (ESM) | ES2022+ | 无 React/Vue 框架依赖，极致轻量原生实现 |
| **样式体系** | 原生 CSS | - | 自定义变量、Flexbox、clamp、env 安全区域 |
| **3D 图形引擎 (主页)** | Three.js | `^0.184.0` | 场景、相机、实例化网格、着色器材料、后期处理 |
| **3D 图形引擎 (画廊)** | Three.js (CDN) | `r128` | 硬编码外部 CDN 引入，存在版本割裂 |
| **动画引擎** | GSAP | `^3.15.0` | 文字入场过渡动效 |
| **事件总线** | mitt | `^3.0.1` | 视口调整与组件间轻量事件订阅 |
| **调试与性能** | lil-gui / stats.js | `^0.21.0` / `^0.17.0` | `#debug` 模式下的参数微调与帧率监测 |

---

## 3. 目录结构与架构拓扑

```text
ivy-memories/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages CI/CD 自动部署工作流
├── public/                     # 静态资产目录（Vite 自动原样拷贝至 dist）
│   ├── arrow.svg               # 图标
│   ├── favicon.jpg             # 站点图标 (304 KB)
│   ├── gallery.html            # 画廊单页面 (包含独立样式、JS 与 Three.js r128 CDN)
│   ├── image.png               # 主页 3D 网格贴图 (1.96 MB)
│   └── img/                    # 画廊照片资源 (13 张，总计约 27.6 MB)
│       ├── 0.png ~ 12.png
├── src/                        # 主页源代码目录 (Vite root 设在此处)
│   ├── index.html              # 主页入口 HTML
│   ├── script.js               # 主页逻辑入口 (实例化 Orchestrator 与 GSAP 动效)
│   ├── style.css               # 主页样式表
│   └── ThreeJS/                # 面向对象的 3D 渲染模块体系
│       ├── Camera.js           # 透视相机控制、视口自适应、单指旋转与双指捏合缩放
│       ├── Orchestrator.js     # 3D 场景主协调器 (单例模式、动画主循环、销毁清理)
│       ├── Renderer.js         # WebGLRenderer 与后期处理合成管线 (EffectComposer)
│       ├── Stage.js            # 核心业务场景：32x18 InstancedMesh、光照、自定义着色器
│       ├── Effects/
│       │   ├── MouseTrail.js   # 触控/鼠标轨迹追踪，转换为 DataTexture 传递给着色器
│       │   └── VignetteRGBShiftShader.js  # 暗角与色散后期处理 ShaderPass
│       └── Utils/
│           ├── Debug.js        # lil-gui 调试面板管理 (#debug 唤起)
│           └── Sizes.js        # 视口尺寸监听与 mitt 事件分发
├── vite.config.js              # Vite 配置文件
├── package.json                # 项目依赖与 npm scripts
└── README.md                   # 项目介绍文档
```

---

## 4. 核心渲染与交互管线剖析

### 4.1 主页 3D 波纹网格 (ThreeJS Pipeline)
1. **实例化网格 (InstancedMesh)**：
   - 采用 32 列 × 18 行共 576 个 `BoxGeometry(0.8, 3, 0.8)`。
   - 自定义属性 `aOffset`（二维世界坐标 XZ）绑定到每个实例。
2. **GPU 顶点动态位移**：
   - 动态劫持 `MeshPhongMaterial` 的着色器代码（`onBeforeCompile`）。
   - `MouseTrail.js` 将用户移动轨迹点编码为 128×1 的 RGBA Float `DataTexture`（包含 X, Z, age, distDelta）。
   - 在顶点着色器中，对每个立方体计算高斯波峰传播方程，并基于距离和时间指数衰减，对 `position.y > 0.0` 的上顶面施加平滑垂直位移。
3. **后期处理 (PostProcessing)**：
   - 使用 `EffectComposer` 依次挂载 `RenderPass` -> `ShaderPass(VignetteRGBShiftShader)` -> `OutputPass`。
   - 边缘有轻微的色彩分离（RGB Shift）和暗角效果，强化 3D 景深与氛围。
4. **手势与视口自适应**：
   - 监听 Pointer Events，记录活跃触点。
   - 单指移动：改变相机水平与仰俯角度（`Camera._updatePosition`）；
   - 双指捏合：动态调整 `zoom` 和 `fitRadius`，实现双指捏合缩放；
   - 针对触控设备（`isTouch`），在 `Camera.fitViewport` 中按宽高比与安全边距自动拉远相机，保证网格完全处于可视区。

### 4.2 画廊页流体滚动与透镜交互 (Gallery Pipeline)
1. **Reel-Flux 曲线相册**：
   - 将 13 张图片材质绑定到自定义着色器平面网格上。
   - 顶点的 X 坐标与滑动速度 `uVel` 耦合，在 X/Y/Z 轴叠加正弦波与微扭曲（Twist），形成动态流动的胶片卷轴视觉。
2. **阻尼滑动系统**：
   - 监听 `wheel` 与 `pointermove`，带有限速与指数阻尼衰减，支持惯性滑行与自动慢速巡游。
3. **透镜模式 (Lens Overlay)**：
   - 单击单张照片后，开启全屏覆盖层，切换至 OrthographicCamera 进行正交全景渲染。
   - 片元着色器 `LENS_FS` 实现了高斯波纹扰动、随机噪点、动态方形遮罩与向心/离心透镜色散畸变。

---

## 5. 现存构建与质量评估

### 5.1 构建状态与 Scripts
- 执行命令：`npm run build`
- 结果：**构建成功（Exit Code 0），耗时约 636ms**。
- 可用脚本：
  - `npm run dev`：启动本地 Vite 开发服务器。
  - `npm run build`：执行打包输出至 `dist/`。
- 缺失项：
  - 无代码检查工具（ESLint / Prettier）。
  - 无单元测试或端到端测试（Vitest / Playwright）。
  - 无性能分析或 CI 自动化基准测试工具。

### 5.2 资源与体积严重瓶颈（移动端杀手级隐患）
通过对 `public/` 资产目录的彻底扫描，发现灾难级的静态资源体积：
1. **画廊照片总体积超 27.6 MB**：
   - `public/img/0.png` ~ `12.png` 均为未压缩的高清 PNG 原图，平均每张在 1.6MB ~ 2.9MB 之间。
   - 移动端首次打开相册需要一次性加载 13 张大图，网络请求体极大，首屏耗时极长。
2. **主页网格贴图超重**：
   - `public/image.png` 达 1.96 MB。
3. **Favicon 超重**：
   - `public/favicon.jpg` 达 304 KB（小图标通常应在几 KB 至几十 KB 内）。
4. **内存与崩溃风险**：
   - 移动设备 GPU 显存受限，直接载入 13 张 2K+ 高清未压缩纹理，极易造成移动端 Safari / Chrome 的 WebGL Context Lost 崩溃。

### 5.3 架构割裂与模块管理缺陷
1. **多页面未纳管入 Vite**：
   - `public/gallery.html` 被简单放置在 `public/` 目录下，绕过了 Vite 打包流程。
   - 导致：
     - 画廊页无法享受 Vite 代码压缩、混淆与 Tree-shaking。
     - 画廊页强行通过 CDN `<script src="https://cdnjs.cloudflare.com/.../three.min.js">` 引用老旧的 `Three.js r128`。
     - 一旦处于离线、国内无翻墙环境或 CDN 抖动，相册将直接加载失败白屏！
2. **主页 Bundle 过大警告**：
   - Vite 报告 `dist/assets/index-*.js` 为 659.46 kB（gzip 后 176.34 kB），超过 500 kB 警报阈值。需要考虑代码拆分或动态导入。

### 5.4 代码质量、死代码与 Bug 清单
1. **`Orchestrator.js` 潜在空指针报错**：
   - 第 102 行：`this.camera.controls.dispose();`。
   - 事实：`Camera.js` 内部并**未**定义 `this.controls`（第 139 行已被注释）。一旦在生命周期内调用 `orchestrator.destroy()`，将直接抛出异常崩溃。
2. **`script.js` 无效定时器与 DOM 查询**：
   - 第 8-23 行：`updateTime()` 尝试查询 `#local-time` 并设置每分钟定时器。
   - 事实：当前 `index.html` 中已无 `#local-time` 元素，执行纯属多余消耗。
3. **`style.css` 大量死代码**：
   - 包含从历史模板残留的 `.hero-section`, `.nav-links`, `.nav-socials`, `.nav-time`, `.bar-location`, `.bar-projects`, `.bar-availability` 等未被使用的废弃 CSS。
4. **`public/gallery.html` 拼写错误**：
   - 第 6 行 `<title>Ivy Lawon</title>` 缺少字母 "s"，应为 `Ivy Lawson`。
5. **手势冲突与手感瑕疵**：
   - 主页上移动端单指轻划时，`Camera.js` 与 `MouseTrail.js` 同时捕获该手势，使得用户意图产生涟漪时摄像机出现抖动或倾斜。

---

## 6. 移动端适配与重构建议路线图

为满足需求文件（R1: 全面重构与移动端适配；R2: 性能评估与测试），建议后续执行团队重点实施以下优化：

1. **统一架构与打包体系 (Vite Multi-Page App)**：
   - 将 `public/gallery.html` 迁入 `src/`（例如 `src/gallery.html` 与 `src/gallery.js`），并在 `vite.config.js` 中配置 `rollupOptions.input` 实现规范的双入口多页面打包。
   - 统一使用 npm 本地的 `Three.js` 依赖，彻底剔除外部 CDN 隐患。
2. **移动端深度交互与手势调优**：
   - 主页：分离或降低单指滑动对视角的旋转灵敏度（或设定长按/双指旋转视角，单指专注水波纹），防止视角晃动。
   - 画廊页：优化移动端惯性滚动的阻尼感与边界回弹，增强点击进入 Lens Overlay 的视觉反馈与全屏适配（特别是横屏与折叠屏设备）。
   - 强化 `100dvh` 与 `safe-area-inset` 的严密防护。
3. **性能工程与图片全面优化 (至关重要)**：
   - 将 13 张高清照片与背景图转码为高压缩率的现代化 WebP 格式，将 30MB+ 资产压缩至 2~3MB 以内。
   - 在画廊中引入纹理按需懒加载或缩略图机制，避免移动端 WebGL 显存溢出。
4. **代码净化与质量加固**：
   - 修复 `Orchestrator.destroy()` 的 `controls` 报错。
   - 清理 `style.css` 与 `script.js` 中的历史废弃代码。
   - 修正页面 Title 拼写。
5. **性能基准与自动化检测**：
   - 构建完成后，通过 Lighthouse 或自动化脚本（Chrome DevTools MCP / Lighthouse Audit）针对移动端与桌面端分别跑分，输出客观的性能、无障碍与最佳实践报告。
