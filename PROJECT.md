# Project: ivy-memories 全方位移动端适配与性能重构

## Architecture
- **核心技术栈**: 原生 Vanilla JavaScript (ESM) + Three.js + GSAP + Vite
- **双页面架构**:
  - 主页 (`src/index.html`, `src/script.js`, `src/style.css`, `src/ThreeJS/`): 3D 立方体波纹网格交互与个人展示
  - 相册画廊 (`src/gallery.html` 或多页面配置): 3D 卷轴相册画廊与细节透镜查看器
- **移动端架构原则**:
  - 全尺寸自适应 (320px ~ 430px, 768px 平板, 横屏, 刘海屏安全区)
  - 资源极简化加载 (WebP 现代化格式，显存/带宽消耗降低 80% 以上)
  - 触控人机工学 (轻触大图高容差识别、透镜手势避让指尖、双指缩放与下滑退出)
  - 渲染自适应调优 (移动端着色器轻量化、离屏 Pass 优化、单 WebGL 上下文)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 静态图片资源现代格式 WebP 压制与自适应 | 将 30MB+ PNG/JPG 转换为高质量 WebP，缩减 80%~90% 体积，消除 56MB 显存超标 | M1_ASSETS | survey (explorer_arch, explorer_perf) |
| 2 | 现代化 Favicon 替换 | 替换 304KB 超重 jpg 图标为轻量矢量/格式图标 | M1_ASSETS | survey (explorer_perf) |
| 3 | 画廊页面 Vite 多页面应用整合 (MPA) | 消除对外部 CDN Three.js r128 的依赖，统一纳入 Vite 构建与本地 three 模块 | M2_ARCH | survey (explorer_arch) |
| 4 | 代码异味与崩溃 Bug 消除 | 修复 Orchestrator.destroy 空指针报错、移除无效定时器、修正标题拼写 | M2_ARCH | survey (explorer_arch) |
| 5 | 全局 Safe Area Insets 补齐与横屏修复 | 解决横屏模式左右安全区缺失导致刘海屏穿模的问题 | M3_RESPONSIVE_UI | survey (explorer_responsive) |
| 6 | 媒体查询整合与冗余 CSS 清理 | 消除两套相互竞争覆盖的 `@media (max-width: 768px)`，清理残留死类名 | M3_RESPONSIVE_UI | survey (explorer_arch, explorer_responsive) |
| 7 | 移动端导航抽屉组件 (Hamburger Menu) | 主页新增折叠式汉堡菜单与关于/作品导航抽屉，优化小屏信息架构 | M3_RESPONSIVE_UI | survey (explorer_responsive) |
| 8 | 小屏与折叠屏自适应排版优化 | 优化 320px 超小屏元素拥挤、修复画廊 5:3 竖屏过度留白及折叠屏拉伸 | M3_RESPONSIVE_UI | survey (explorer_responsive) |
| 9 | 触控点击判定重构与轻触容差放宽 | 解决 `< 10px` 阈值导致手指轻触唤出大图失败的问题，提升为时间+位移复合识别 | M4_INTERACTION | survey (explorer_responsive) |
| 10 | 全屏透镜触控人机工学重构 (Offset Loupe) | 透镜中心上移 60px 避开指尖遮挡，新增下滑退出与点击空白关闭 | M4_INTERACTION | survey (explorer_responsive, explorer_perf) |
| 11 | 主页触控视角旋转与波纹手势解耦 | 分离轻触激起波纹与拖拽平滑旋转，消除移动端误触水波暴走 | M4_INTERACTION | survey (explorer_perf) |
| 12 | 画廊滑动阻尼与卡片磁吸居中 | 触屏滑动增加惯性衰减与滑动停止时的最近卡片智能居中对齐 | M4_INTERACTION | survey (explorer_perf) |
| 13 | WebGL 移动端渲染管线降级优化 | 移动端跳过 EffectComposer 多重离屏 Pass，改用 CSS 暗角蒙版 | M5_PERF_PIPELINE | survey (explorer_perf) |
| 14 | 顶点着色器与轨迹点开销调优 | 移动端将轨迹点上限降为 32-48，精简单帧 530 万次着色器循环 | M5_PERF_PIPELINE | survey (explorer_perf) |
| 15 | 画廊 WebGL 上下文合并 | 消除双渲染器/双 Canvas 引起的双上下文冲突与内存浪费 | M5_PERF_PIPELINE | survey (explorer_perf) |
| 16 | 自动化 Lighthouse 性能评测与数据验证 | 执行完整移动端弱网与节流测试，输出真实客观指标对比报告 | M6_PERF_TEST | ORIGINAL_REQUEST R2 |
| 17 | 独立 UI/UX 评审员打分评估 (Agent-as-Judge) | 设立独立 UI/UX 评审专家对移动端实际体验和最佳实践进行多维量化打分 | M7_JUDGE_AUDIT | ORIGINAL_REQUEST Criteria |
| 18 | 代码真实性与无占位符完整性审查 | 严格检查零占位符、零语法构建错误、零作弊硬编码 | M7_JUDGE_AUDIT | ORIGINAL_REQUEST Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | M1_ASSETS | 静态图片资产 WebP 压制、自适应缩放与轻量化 | none | DONE |
| M2 | M2_ARCH | Vite 多页面整合、本地依赖统一、Bug 与死代码修复 | none | DONE |
| M3 | M3_RESPONSIVE_UI | 全局安全区、媒体查询整理、移动端导航抽屉、小屏排版 | M2 | DONE |
| M4 | M4_INTERACTION | 画廊轻触识别、透镜避让指尖与下滑退出、手势解耦与磁吸居中 | M2 | DONE |
| M5 | M5_PERF_PIPELINE | WebGL 移动端降级、着色器轻量化、画廊单上下文合并 | M1, M2 | DONE |
| M6 | M6_PERF_TEST | Lighthouse 自动化测试与移动端性能指标数据收集 | M1, M2, M3, M4, M5 | DONE |
| M7 | M7_JUDGE_AUDIT | 独立 UI/UX 评审打分 (Agent-as-Judge) 与审计员代码完整性审查 | M6 | DONE |

## Interface Contracts
### Assets & Path Resolution
- 所有优化后的图片统一输出至 `public/img/` 与 `public/image.webp` (兼容回退 png)。
- 画廊图片数组与背景纹理需支持现代格式并具备平滑加载回调。

### Multi-page Entry Contract
- `vite.config.js` 配置多页面输入：`index: 'src/index.html'`, `gallery: 'src/gallery.html'`（或兼容路由）。
- 确保执行 `npm run build` 时，两个页面均被 Vite 完整打包输出到 `dist/`。

### Mobile Interaction Contract
- 点击与拖拽事件标准：触控位移小于 18px 且触摸时长小于 350ms 判定为 Tap 点击；否则判定为平移拖动。
- 透镜视图坐标：移动端触控模式下，采样中心计算需加上 60px 垂直偏置；支持触摸向下滑动超过 80px 触发关闭。

## Code Layout
- `public/`: 静态资源（WebP 图片、轻量 favicon、音频/配置文件等）
- `src/index.html`: 主页 HTML 入口，包含新增移动端导航结构
- `src/style.css`: 统一的响应式样式表，包含全尺寸断点与安全区适配
- `src/script.js`: 主页交互与业务脚本
- `src/ThreeJS/`: 3D 渲染核心（Camera, Stage, Renderer, Sizes 等）
- `src/gallery.html`: 现代化重构后的画廊页面（集成于 Vite 管线）
- `scripts/`: 性能测试脚本（Lighthouse 审计自动化脚本等）
