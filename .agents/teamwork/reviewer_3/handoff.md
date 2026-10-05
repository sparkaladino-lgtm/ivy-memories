# SWE Light 对抗性审查与加固交付报告 (Round 3 - 终审轮)

> [!WARNING] **Skepticism Disclaimer**
> 尽管已在真实 Headless Chrome (Blink 内核) 下完成了涵盖全量 13 张照片全部台词逐字校验、闭环转场遍历、PC 4K 至极端矮屏全视口防遮挡及双环境（开发模式 Vite Dev 与生产构建 dist/）的端到端自动化深度攻击，但在非 Blink 引擎（如 iOS Safari WebKit 真机底层触摸事件驱动）及超低显存设备下的 WebGL 纹理上传延迟场景，仍需保持客观审慎。

---

## 1. 前序实现存在的缺陷与隐患 (What the prior attempt got wrong)

### 缺陷 1：快速重开与切图时的打字机状态泄漏 (Typewriter Timer Leak & State Overwrite)
- **Input**：用户在照片 1 打开后正在逐字打字期间，快速切换到其他照片（或通过脚本高频调用 `openLensOverlay` / `__openPhoto`）。
- **Expected**：旧照片的故事打字机立即彻底终止，旧对话框立即隐藏并清空残留文本，新照片在 800ms 展开稳定后启动全新打字机。
- **Actual**：前序实现中的 `openLensOverlay` 未调用 `stopStory()`，旧卡片的 `storyState.timer` 依然在后台每 75ms 触发一次并将旧台词继续塞入 DOM，且旧对话框继续保持 `active` 状态长达 800ms。若用户在此期间点击对话框，会错误推进旧卡片的故事逻辑。
- **Root Cause**：`openLensOverlay()` 函数在启动新卡片时缺少前置 `stopStory()` 清理调用。

### 缺陷 2：卡片开关动画异步定时器竞态污染 (Asynchronous Lens Timer Race)
- **Input**：用户点击关闭按钮（`closeLens()`）后 100~300ms 内，手速极快地重新点击卡片或切换卡片。
- **Expected**：前一次关闭操作的延时回调被立即废弃，新卡片的放大与转场状态不受干扰。
- **Actual**：前序实现中使用匿名的 `setTimeout(..., 400)` 重置 `lensTransitioning` 与 `resetLensZoom()`，未保存计时器句柄。导致新卡片刚打开 100ms 时，旧的关闭定时器突然触发，意外篡改了新卡片的缩放与过渡状态。
- **Root Cause**：`closeLens` 与 `openLensOverlay` 的 400ms 异步复位逻辑未引入 `closeLensTimer` 与 `openLensTimer` 的句柄跟踪与互斥清理机制。

### 缺陷 3：卡片转场过渡切图期间对话框残留 (Dialog Leak during Photo Transition)
- **Input**：在每张卡片最后一句台词打完后点击进入转场（`goToNextPhoto()`）。
- **Expected**：对话框及打字机状态彻底停止并清空。
- **Actual**：前序实现仅执行了 `pixelDialog.classList.remove("active")`，未清理打字机定时器及文字内容。在转场完成弹出下一张卡片的瞬间，偶现上一句残影闪烁。
- **Root Cause**：`goToNextPhoto` 中未调用 `stopStory()` 执行完备的打字机状态重置。

### 缺陷 4：PC 键盘空格键在按钮焦点停留时的原生误触 (Spacebar Focus Trigger Conflict)
- **Input**：用户此前点击过右上角关闭按钮（或通过键盘 Tab 聚焦到了按钮），随后使用 Space（空格键）尝试快进对话台词。
- **Expected**：空格键纯粹用于推进剧情对话，不得误触关闭按钮。
- **Actual**：焦点停留在 DOM 按钮上时，原生浏览器可能产生空格激活按钮的默认行为，导致快进对话时误关闭卡片。
- **Root Cause**：`openLensOverlay` 时未对当前聚焦元素执行 `blur()` 清除焦点。

---

## 2. 本轮代码修改明细 (What I changed)

### 1. `src/gallery.html`
- **生命周期与定时器守卫加固**：
  - 新增 `closeLensTimer` 与 `openLensTimer` 句柄；
  - 在 `closeLens()` 中添加前置清理：取消任何现存的开启/关闭定时器；
  - 在 `openLensOverlay()` 中添加完备重置：清理存量定时器、调用 `stopStory()` 终止旧打字机、调用 `cancelPhotoTransition()` 取消遗留动画；
  - 在 `openLensOverlay()` 中加入 `if (document.activeElement && typeof document.activeElement.blur === "function") document.activeElement.blur();`，杜绝空格/回车误触已聚焦按钮；
  - 在 `goToNextPhoto()` 中将单纯的 `classList.remove("active")` 升级为调用 `stopStory()`，彻底终结残留打字机并清空文本。
- **生产构建产物同步**：
  - 重新执行 `npm run build`，Rollup/Vite 将最新改动编译打包至 `dist/gallery.html` 与 `dist/assets/*`，确保开发模式与生产环境 100% 行为一致。

---

## 3. 验证记录 (Verification Record)

### 深度验证 (Deep Verification - ran actual tests)
采用真实 Headless Chrome (Blink 内核) + Chrome DevTools Protocol (CDP) 驱动，执行自动化对抗性审查脚本：
- **执行命令**：`node .agents/teamwork/reviewer_3/adversarial_round3.mjs`
- **验证结果 (100% 全部通过，耗时约 40s，退出码 0)**：
  1. **Phase 1: 静态合规审计**
     - `public/gallery.html` 确认不存在（避免 Vite 路由劫持）：**PASS**
     - 13 段故事全部标题、每段全部台词在 `src/gallery.html` 中逐字比对：**PASS (100% 精确匹配)**
     - 生产构建产物 `dist/` 校验：全部 13 段故事台词均已打包进入生产包：**PASS**
     - 零音频资产与零 Web Audio API 合规性扫描：全工作区（src/public/dist）0 音频文件、0 API 引用：**PASS**
  2. **Phase 2: 开发模式 (Vite Dev Server) 端到端深度攻击**
     - **Subtest A1 (PC 1080p 卡片 1 点击与打字机输出)**：卡片 1 正常放大，像素对话框 `active`、`opacity=1`、`zIndex=100`，字号 `15.2px`，文字高对比度可见；点击快进全句瞬间呈现：**PASS**
     - **Subtest A2 (全量 13 张照片从 1 到 13 全流程连贯穿越)**：
       - 照片 1 (`ARCHIVE // 01`，4句)：PASS
       - 照片 2 (`ARCHIVE // 02`，3句，含极端短句 `"..."`)：PASS
       - 照片 3 (`ARCHIVE // 03`，4句)：PASS
       - 照片 4 (`ARCHIVE // 04`，4句)：PASS
       - 照片 5 (`ARCHIVE // 05`，2句)：PASS
       - 照片 6 (`ARCHIVE // 06`，2句)：PASS
       - 照片 7 (`ARCHIVE // 07`，2句)：PASS
       - 照片 8 (`ARCHIVE // 08`，2句)：PASS
       - 照片 9 (`ARCHIVE // 09`，2句)：PASS
       - 照片 10 (`ARCHIVE // 10`，3句)：PASS
       - 照片 11 (`ARCHIVE // 11`，3句)：PASS
       - 照片 12 (`ARCHIVE // 12`，2句)：PASS
       - 照片 13 (`ARCHIVE // 13`，3句，含英文台词)：PASS
       - 照片 13 结束后点击平滑故障转场，成功循环回转至照片 1：**PASS**
     - **Subtest A3 (高频连续锤击攻击)**：500ms 内向对话框连续发起 25 次高频 click 事件，无 NaN、无 Step 越界、无控制台报错：**PASS**
     - **Subtest A4 (快速连续打断与重新打开)**：以 80ms~100ms 超短间隔连续切换卡片 2 -> 卡片 5 -> 卡片 12，最终稳定呈现卡片 12 且无任何状态错位：**PASS**
     - **Subtest A5 (PC 至移动端 6 套视口可见性与防遮挡攻击)**：
       - `PC_4K_3840x2160`: inViewport=true, vhRatio=0.079, unblocked=true (PASS)
       - `PC_1080p_1920x1080`: inViewport=true, vhRatio=0.157, unblocked=true (PASS)
       - `PC_Laptop_1366x768`: inViewport=true, vhRatio=0.221, unblocked=true (PASS)
       - `PC_Compact_1024x500`: inViewport=true, vhRatio=0.180, unblocked=true (PASS)
       - `PC_UltraShort_800x360`: inViewport=true, vhRatio=0.265, unblocked=true (PASS)
       - `Mobile_Narrow_375x667`: inViewport=true, vhRatio=0.211, unblocked=true (PASS)
       通过 `document.elementFromPoint` 检测中心点无任何遮挡，文字与边框完全位于可视区域内。
  3. **Phase 3: 生产模式 (dist/ 静态构建产物独立验证)**
     - 本地启动独立静态 HTTP 服务器 (port 8088) 加载 `dist/` 构建产物；
     - 验证生产环境卡片 1 打开、Space 键盘快进打字、Enter 键盘推进台词：**PASS**
     - 全程控制台拦截审计：**0 console errors, 0 page errors** (PASS)

### 现场测试留存截图清单
- `.agents/teamwork/reviewer_3/dev_card1_open_pc1080p.png` (开发环境 PC 1080p 对话框渲染)
- `.agents/teamwork/reviewer_3/dist_verified_1080p.png` (生产环境 PC 1080p 对话框渲染)
- `.agents/teamwork/reviewer_3/viewport_PC_4K_3840x2160.png` (PC 4K 宽屏)
- `.agents/teamwork/reviewer_3/viewport_PC_1080p_1920x1080.png` (PC 1080p)
- `.agents/teamwork/reviewer_3/viewport_PC_Laptop_1366x768.png` (PC 笔记本)
- `.agents/teamwork/reviewer_3/viewport_PC_Compact_1024x500.png` (PC 紧凑矮窗口)
- `.agents/teamwork/reviewer_3/viewport_PC_UltraShort_800x360.png` (极端矮屏横屏)
- `.agents/teamwork/reviewer_3/viewport_Mobile_Narrow_375x667.png` (移动端窄屏)

### 浅层验证 (Shallow Verification)
- 代码审计 `dist/gallery.html`，确认打包引用的内联着色器及组件结构无冗余外部依赖。

### 未验证场景 (Unverified aspects)
- 真实物理 iOS Safari 硬件设备（依赖 Chromium 移动端仿真环境）；
- 极端弱网（如 20kbps）环境下的首批大图并发异步解码。

---

## 4. 已知问题台账 (Known Issues)
- `Minor Robustness Risk`: 极端弱网环境下首次加载未完成纹理下载时，需要等待 TextureLoader 回调后才展示全清图片（已有 fallback 机制保证不发生崩溃）。
- `Shallow Verification`: 暂未在 Linux Wayland 原生环境测试字体抗锯齿子像素渲染。

---

## 5. 剩余风险与结论 (Remaining risk & next step)
本轮终审（Round 3）针对前序实现遗留的 4 处潜伏隐患（卡片快速重开打字机泄漏、开关定时器竞态污染、转场对话框残影、按钮焦点空格冲突）进行了深度修复与代码加固。
通过 CDP 在 Chrome 浏览器真实内核下，针对 Vite 开发服务与 dist 生产构建两套环境进行了全量 13 张照片全部台词逐字验证、跨图循环回转、高频攻击以及 6 种 PC/移动端视口防遮挡测试，全部 100% 通过。
结论：需求 R1 与 R2 已完全达成，代码稳健性与表现一致性达到最高标准，判定为 **FINAL APPROVED (PASS)**。
