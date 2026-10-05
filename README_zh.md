# Ivy Memories

[**🇬🇧 English Version**](./README.md)

**在线预览 (Live Demo):** [https://sparkaladino-lgtm.github.io/ivy-memories/](https://sparkaladino-lgtm.github.io/ivy-memories/)

这是一个为了庆祝今年艾维（Ivy Lawson）10月21日生日而特别设计与开发的交互式 3D 纪念展示网站。

项目基于现代 WebGL 技术栈，构建了一个沉浸式、如梦似幻的 3D 记忆画廊。用户可以在其中浏览艾维的记忆切片，感受跨越时空的独特视觉与情感体验。

## 🚀 技术栈与架构设计

本项目没有依赖 React/Vue 等重型 UI 框架，而是完全聚焦于高性能的原生 WebGL 渲染与纯粹的 DOM 交互，以追求极致的加载速度和渲染性能：

- **核心 3D 渲染引擎：** [Three.js](https://threejs.org/)
  - 驱动整个 3D 场景的构建、正交相机系统的数学计算、网格生成以及纹理映射。
- **自定义着色器编程 (Shader)：** GLSL (OpenGL Shading Language)
  - 抛弃了普通材质，深度定制了顶点着色器 (Vertex Shader) 与片段着色器 (Fragment Shader)。实现了底部的波浪网格扭曲、记忆画廊的 RGB 色散（Chromatic Aberration）以及极其逼真的玻璃透镜折射效果。
- **时间轴动画引擎：** [GSAP](https://gsap.com/) (GreenSock Animation Platform)
  - 负责处理复杂的电影级时间轴轨道。包括 3D 相机的平滑移动、图片的放大缩小变形，以及画廊与透镜状态之间的无缝过渡。
- **极速构建工具：** [Vite](https://vitejs.dev/)
  - 在开发阶段提供闪电般的热更新 (HMR)，在生产环境下利用 Rollup 进行底层打包与深度代码压缩。
- **原生音频合成技术：** Web Audio API (`AudioContext`)
  - 彻底抛弃了外部音频文件加载。通过代码动态生成振荡器（Oscillator），在底层直接合成出经典的 8-bit 三角波音频，完美模拟复古打字机的机械敲击声。
- **响应式排版与样式：** 纯 CSS3
  - 使用 CSS 变量与多重媒体查询，完美适配从 4K 桌面端显示器、平板电脑到超窄屏手机的布局。内嵌 `Press Start 2P` 像素字体，烘托 RPG 游戏的复古对话氛围。

## ✨ 核心亮点功能

1. **交互式波浪记忆网格**：主页底部的流体矩阵会对用户的鼠标滑动或手指触摸产生实时的物理涟漪反馈。
2. **光学透镜画廊**：在画廊中点击任意记忆碎片，图片会瞬间化作一枚放大透镜。通过底层 GLSL 计算光线偏移，实现极其真实的玻璃质感与折射效果。
3. **沉浸式打字机叙事**：在浏览透镜图片时，底部会升起像素风对话框，以逐字敲击（配合实时生成的合成音效）的方式再现艾维的内心独白。支持点击屏幕一键补全或快速切换下一句。

---

## 🛠 源码使用与本地部署教程

如果你想在本地运行或二次开发这个项目，请按照以下步骤操作：

### 1. 准备环境
确保你的电脑上已经安装了 [Node.js](https://nodejs.org/)（推荐最新的 LTS 长期支持版本）。

### 2. 下载源码
```bash
git clone https://github.com/sparkaladino-lgtm/ivy-memories.git
cd ivy-memories
```

### 3. 安装依赖项
打开终端（Terminal），运行以下命令安装项目所需的依赖包：
```bash
npm install
```

### 4. 本地启动运行
依赖安装完成后，运行以下命令启动本地开发服务器：
```bash
npm run dev
```
启动成功后，终端会打印出一个本地地址（通常是 `http://localhost:5173/`）。在浏览器中打开它即可实时预览。当你修改代码时，页面会自动秒级刷新。

### 5. 构建发布版本 (生产环境打包)
如果你想把网站部署到服务器或 GitHub Pages 等静态托管平台，运行：
```bash
npm run build
```
这将在项目根目录下生成一个 `dist` 文件夹，里面包含了经过混淆、压缩和优化后的最终静态文件，可以直接上传部署。
