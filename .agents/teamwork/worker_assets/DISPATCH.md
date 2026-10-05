## 2026-10-05T01:25:58Z
# DISPATCH — worker_assets

- Milestone: M1_ASSETS
- Role: Media & Assets Lightweighting Worker
- Working Directory: c:\Users\石志鸿\Desktop\ivy-memories\.agents\teamwork\worker_assets
- Project Root: c:\Users\石志鸿\Desktop\ivy-memories
- Scope Document: c:\Users\石志鸿\Desktop\ivy-memories\PROJECT.md
- Original Request: c:\Users\石志鸿\Desktop\ivy-memories\.agents\teamwork\ORIGINAL_REQUEST.md
- Write Ownership: `public/img/`, `public/image.*`, `public/favicon.*` (严禁越权修改其他文件)

## 任务目标
1. 解决移动端重大性能瓶颈：当前 30MB+ 静态图片资源导致 4G 网络下首屏白屏 18s+ 及 56MB GPU 显存占用。
2. 处理 `public/image.png`：
   - 现为 5000x2812 伪 PNG（实为 JPEG 格式），体积达 1.96MB；
   - 将其按真实呈现需求缩放并压制为高质量现代格式 `public/image.webp`（分辨率可调整为 1920x1080 或 1280x720，体积控制在 100KB~200KB 以内），同时保留一个兼容的回退 `public/image.png`（压缩后的版本，体积控制在 200KB 左右），确保 WebGL 纹理加载快、显存小。
3. 处理画廊 `public/img/0.png` ~ `12.png`：
   - 13 张原图目前为 26.8MB 的大图；
   - 利用 sharp、imagemin 或 node/powershell 原生脚本/Canvas/外部可用工具，将这 13 张图片批量转换为高质量 WebP 格式（保留清晰画质，单张控制在 100~200KB，总量由 26.8MB 降低到 2MB 左右）；
   - 同时生成相应的微型占位或保持兼容命名，确保画廊能无缝高效读取。
4. 替换 `public/favicon.jpg`（304KB 过大），生成轻量现代 favicon（可转为轻量 SVG 或 32x32/48x48 格式，体积降至 < 10KB）。
5. 验证资源体积总降幅，并在工作目录下产出 `handoff.md`。

## 诚信规范
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
