# “My Memory”画廊像素风文字介绍功能架构勘探报告

## 1. 观察 (Observation)

### 1.1 画廊页面与灯箱代码定位
- **文件定位**：画廊所有核心逻辑集中于单一源码文件 `src/gallery.html`（总行数 1005 行）。
  - `vite.config.js` 第 23 行明确将 `src/gallery.html` 配置为 Rollup 打包入口：`gallery: resolve(__dirname, "src/gallery.html")`，打包产物输出至 `dist/gallery.html`。
  - `public/gallery.html` 为早期未引入移动端适配与 Shader 重构的历史残留静态文件，业务开发只需关注 `src/gallery.html`。
- **DOM 结构与层级**（`src/gallery.html` 第 202-230 行）：
  - `.canvas-wrapper#canvasWrapper`（Line 202，z-index: 1）：Three.js 主滚轮画廊挂载点；
  - `.overlay`（Line 204，z-index: 2）：包含返回按钮 `.back-btn` 与计数器 `.counter#counter`；
  - `.gallery-title`（Line 222，z-index: 3）：标题 “My Memory”；
  - `#lensOverlay`（Line 225-229，z-index: 10）：灯箱/模态放大遮罩容器：
    ```html
    <div id="lensOverlay">
      <button id="lensCloseBtn" aria-label="关闭照片">&times;</button>
      <div id="lensCanvasContainer"></div>
    </div>
    ```
- **放大状态与类名切换**（`src/gallery.html` 第 120-129 行）：
  - 放大激活时，向 `#lensOverlay` 添加 `.active` 类名：
    ```css
    #lensOverlay {
      position: fixed; inset: 0; width: 100%; height: 100%; z-index: 10;
      background: #f5f0ea; opacity: 0; pointer-events: none;
      transition: opacity 0.4s ease;
    }
    #lensOverlay.active { opacity: 1; pointer-events: auto; }
    ```

### 1.2 放大状态与生命周期函数
- **打开放大**：`src/gallery.html` 第 963 行 `function openLensOverlay(tex)`。
  - 触发源（Line 484-499，`endDrag` 函数）：主画布点击判定：
    ```javascript
    var intersects = raycaster.intersectObjects(meshes);
    if(intersects.length > 0) {
      var clickedMesh = intersects[0].object;
      if(clickedMesh.userData && clickedMesh.userData.texture) {
        openLensOverlay(clickedMesh.userData.texture);
      }
    }
    ```
  - **关键代码缺失项**：当前 `build()` 函数（Line 395）中：
    `mesh.userData = { isClickable: true, texture: tex };`
    只存储了 `texture`，未保存图片索引 `i`（0 ~ 12），导致 `openLensOverlay` 无法直接得知当前被点击的具体图片编号。
- **关闭放大**：`src/gallery.html` 第 597 行 `function closeLens()`。
  - 触发源包括 3 处：
    1. 点击右上角关闭按钮（Line 648）：`lensCloseBtn.addEventListener("click", closeLens);`
    2. 点击放大画面外部背景空白区（Line 884-899）：
       ```javascript
       var isOutsideImage = clickDistX > halfImageW || clickDistY > halfImageH;
       if (isOutsideImage) {
         lensPointers.delete(e.pointerId);
         closeLens();
         return;
       }
       ```
    3. 键盘按键（Line 991-998）：`Escape` 键触发 `closeLens()`。

### 1.3 关键交互冲突隐患 (Pointer Event Conflict)
- `lensOverlay` 在 Line 925-928 上监听了全量指针事件：
  ```javascript
  lensOverlay.addEventListener("pointerdown", onLensPointerDown);
  lensOverlay.addEventListener("pointermove", onLensPointerMove);
  lensOverlay.addEventListener("pointerup", onLensPointerUp);
  ```
- 在 `onLensPointerDown` 与 `onLensPointerUp` 中（Line 835, 875）：
  仅排除了 `if (e.target === lensCloseBtn) return;`。
- **冲突现象**：若像素对话框放置于 `#lensOverlay` 内，当用户轻触对话框推进文本时，若未在对话框上阻止冒泡或未在事件处理器中排除对话框，点击位置会被计算为 `isOutsideImage = true`，从而误触发 `closeLens()` 关闭灯箱！或者被误判为双击图片触发 `animateLensZoom` 缩放！

### 1.4 样式与像素风方案现况
- **CSS 架构**：纯原生内联 CSS（`<style>` 标签在 `src/gallery.html` 头部，无 SCSS/Tailwind 预处理器）。
- **媒体查询断点**：`@media (max-width: 768px), (pointer: coarse)`。
- **字体加载现况**：Line 10 已预加载 Google Fonts：
  `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />`。
- **图片尺寸比例**：`public/img/` 下共 13 张图片（`0.png` 至 `12.png`），实测均为 16:9（1920x1080 / 1280x720）。在移动端垂直居中，屏幕底部存在充裕留白（约 200~300px）。

### 1.5 音频与合规检查
- 全局 Grep 搜索 `Audio`、`AudioContext`、`sound`、`.mp3`、`.wav`，搜索结果均为 0，项目中没有任何音频相关依赖或代码。

---

## 2. 逻辑链条 (Logic Chain)

基于上述 1.1 ~ 1.5 观察事实，推导出如下完整解决方案：

1. **DOM 结构挂载点设计**（基于观察 1.1）：
   - 对话框应作为子元素放置在 `#lensOverlay` 内，位于 `#lensCanvasContainer` 之后：
     ```html
     <div id="lensOverlay">
       <button id="lensCloseBtn" aria-label="关闭照片">&times;</button>
       <div id="lensCanvasContainer"></div>
       <!-- 像素风对话框组件 -->
       <div id="pixelDialog" class="pixel-dialog">
         <div class="pixel-dialog-header">
           <span class="pixel-dialog-title" id="pixelDialogTitle">ARCHIVE // 01</span>
           <span class="pixel-dialog-step" id="pixelDialogStep">1 / 3</span>
         </div>
         <div class="pixel-dialog-body">
           <span class="pixel-dialog-text" id="pixelDialogText"></span>
           <span class="pixel-cursor" id="pixelCursor"></span>
         </div>
         <div class="pixel-dialog-footer">
           <span class="pixel-action-prompt" id="pixelActionPrompt">TAP TO ADVANCE ▼</span>
         </div>
       </div>
     </div>
     ```
   - 层级设为 `z-index: 12`（高于 `lensCanvasContainer`，且与 `lensCloseBtn` 的 `z-index: 11` 在视觉上完全分开，无遮挡）。

2. **事件隔离机制**（基于观察 1.3）：
   - 在 `#pixelDialog` 上阻止冒泡：
     `['pointerdown', 'pointerup', 'pointermove', 'click'].forEach(evt => pixelDialog.addEventListener(evt, e => e.stopPropagation()));`
   - 在 `onLensPointerDown`、`onLensPointerMove`、`onLensPointerUp` 开头增加守卫条件：
     `if (e.target === lensCloseBtn || pixelDialog.contains(e.target)) return;`
   - 彻底避免点击对话框时误触 `closeLens()` 或双击缩放。

3. **图片索引传递与故事映射**（基于观察 1.2）：
   - 在 `build()` 循环创建网格时，为 `mesh.userData` 补充图片索引：
     `mesh.userData = { isClickable: true, texture: tex, photoIndex: i };`
   - 在 `endDrag` 命中网格时：
     `openLensOverlay(clickedMesh.userData.texture, clickedMesh.userData.photoIndex);`
   - 定义预设故事数组 `GALLERY_STORIES`，每张图片对应 3 段叙事文本，配合兜底机制，保证 0~12 号图片均有独特的艺术叙事。

4. **纯 CSS 复古 RPG 像素对话框实现**（基于观察 1.4）：
   - **边框与阴影**：利用 `border: 4px solid #f5f0ea` + `outline: 4px solid #1a1815` + `box-shadow: 0 8px 0 0 rgba(0,0,0,0.4)`，模拟经典的无圆角点阵阶梯硬边框（Stepped Pixel Border）；
   - **背景**：采用半透明深咖啡/黑曜石色 `rgba(22, 20, 18, 0.88)` 结合 `backdrop-filter: blur(8px)`，与整站 `#f5f0ea`（暖象牙白）及图片色调形成优雅对比；
   - **字体策略**：
     - 在 `<head>` 引入 Google Fonts `Press Start 2P`（体积仅 ~15KB woff2）：
       `<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />`
     - 字体声明栈：`font-family: 'Press Start 2P', "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", monospace, sans-serif;`
     - 英文字符与数字优先命中 `Press Start 2P` 呈现复古点阵质感；中文字符无缝回退至系统高品质无衬线字体，配合 `letter-spacing: 0.04em; line-height: 1.7;` 与像素黄色闪烁光标（`animation: steps(2, start)`），在零中文体积包的前提下呈现协调沉浸的复古氛围。
   - **多端响应式定位**：
     - 桌面端：`bottom: 2.25rem; left: 50%; transform: translateX(-50%); width: min(92%, 640px);`；
     - 移动端：`@media (max-width: 768px)` 下采用 `bottom: calc(1rem + env(safe-area-inset-bottom)); width: calc(100% - 2rem);`，紧密贴合手机安全区底部，且因 16:9 照片垂直居中，对话框与照片主体完美错开，互不遮挡。

5. **多段打字机与状态机生命周期**（基于观察 1.2）：
   - 状态定义：
     - `currentPhotoIdx`（当前照片编号）
     - `currentStepIdx`（当前段落序号，从 0 开始）
     - `charIdx`（当前字符索引）
     - `isTyping`（当前是否在逐字打印中）
     - `typeTimer`（打字机定时器）
   - **图片打开（`openLensOverlay`）**：
     - 强制重置：`clearTimeout(typeTimer); currentStepIdx = 0; charIdx = 0; isTyping = false;`
     - 显示对话框：`pixelDialog.classList.add("active");`
     - 开始打印第 1 段。
   - **打字过程与点击推进交互**：
     - 若用户在打字中点击对话框（`isTyping === true`）：立即显示完整当前段落文本，取消定时器，切换为等待状态（经典 RPG 跳过动画体验）；
     - 若当前段落已打完，且不是最后一段（`currentStepIdx < lines.length - 1`）：点击后清空文本，`currentStepIdx++`，启动下一段打字机；
     - 若已为最后一段（`currentStepIdx === lines.length - 1`）：提示变为 `FIN ■`，文字与对话框保持常驻显示，直至关闭照片。
   - **图片关闭（`closeLens`）**：
     - 隐藏对话框：`pixelDialog.classList.remove("active");`
     - 销毁定时器：`clearTimeout(typeTimer); isTyping = false;`

---

## 3. 限制与假设 (Caveats)

1. **网络字体降级假设**：Google Fonts `Press Start 2P` 在部分极特殊的离线网络环境下可能无法连接。由于配置了完整的 `monospace`、`"PingFang SC"` 等本地字体回退栈，即使用户离线，排版亦完全正常且不抛出错误，样式布局不受影响。
2. **纯 CSS 锯齿边界精度**：当前采用双重外线（`border` + `outline` + `box-shadow`）是跨端性能与渲染稳定性最佳的方案，无需额外注入 base64 图片或 SVG filter，完全规避了 WebGL 画布混合时的性能开销。
3. **未修改业务代码**：本阶段为只读勘探，未向 `src/gallery.html` 写入任何业务代码。

---

## 4. 结论与具体实施方案 (Conclusion)

### 4.1 核心变更清单
所有变更仅需在 `src/gallery.html` 单个文件中完成：
1. **HTML 头部**：引入 `Press Start 2P` 字体；
2. **HTML 结构**：在 `#lensOverlay` 内部追加 `#pixelDialog` DOM 树；
3. **CSS 样式**：在 `<style>` 中追加 `.pixel-dialog` 及相关像素动画样式，包含 `@media (max-width: 768px)` 移动端适配；
4. **JS 逻辑**：
   - 在 `build()` 中为 `mesh.userData` 添加 `photoIndex: i`；
   - 在 `endDrag()` 中将 `clickedMesh.userData.photoIndex` 传入 `openLensOverlay`；
   - 在 `openLensOverlay()` 中初始化并触发打字机；
   - 在 `closeLens()` 中清理打字机和隐藏对话框；
   - 实现打字机引擎、点击推进、即时完成与多段叙事数据字典；
   - 增加事件拦截与排除逻辑。

### 4.2 提炼的代码设计片段

#### 1. 多段故事数据定义
```javascript
var GALLERY_STORIES = [
  {
    title: "ARCHIVE // 00 · 晨光乍现",
    lines: [
      "微风拂过湖面的那个清晨，水面泛起粼粼金光。",
      "“所有漫长的旅程，都始于一个不经意的回眸。”",
      "阳光把影子拉得很长，时光在这里悄然定格。"
    ]
  },
  {
    title: "ARCHIVE // 01 · 记忆褶皱",
    lines: [
      "穿过街角斑驳的旧墙，耳畔隐约传来远处的喧嚣。",
      "那些未曾说出口的话，已被写进光影的缝隙里。",
      "风停下的时候，故事仍在静默中生长。"
    ]
  },
  {
    title: "ARCHIVE // 02 · 蓝调时刻",
    lines: [
      "黄昏与黑夜交织的界限，天空呈现出深邃的青蓝。",
      "路灯次第亮起，像漂浮在城市海洋中的浮标。",
      "你在暮色中驻足，记录下这片刻的宁静。"
    ]
  },
  // 3 至 12 号图片同样预置个性化诗意三段式叙事...
];
```

#### 2. 打字机控制器逻辑实现
```javascript
var pixelDialog = document.getElementById("pixelDialog");
var pixelDialogTitle = document.getElementById("pixelDialogTitle");
var pixelDialogStep = document.getElementById("pixelDialogStep");
var pixelDialogText = document.getElementById("pixelDialogText");
var pixelActionPrompt = document.getElementById("pixelActionPrompt");

var storyState = {
  photoIndex: 0,
  stepIndex: 0,
  charIndex: 0,
  isTyping: false,
  timer: null
};

function getStoryForPhoto(idx) {
  if (GALLERY_STORIES[idx]) return GALLERY_STORIES[idx];
  return {
    title: "ARCHIVE // " + (idx < 10 ? "0" + idx : idx) + " · 浮光记忆",
    lines: [
      "画面定格在时间长河的一瞬，泛起微弱的涟漪。",
      "视线交汇的瞬间，所有静止的思绪重新流淌。",
      "这是属于流光忽度与常青藤的永恒记录。"
    ]
  };
}

function startStory(photoIdx) {
  clearTimeout(storyState.timer);
  storyState.photoIndex = photoIdx;
  storyState.stepIndex = 0;
  storyState.charIndex = 0;
  storyState.isTyping = false;
  pixelDialog.classList.add("active");
  renderStoryStep();
}

function stopStory() {
  clearTimeout(storyState.timer);
  storyState.isTyping = false;
  pixelDialog.classList.remove("active");
  pixelDialogText.textContent = "";
}

function renderStoryStep() {
  clearTimeout(storyState.timer);
  var story = getStoryForPhoto(storyState.photoIndex);
  var currentLine = story.lines[storyState.stepIndex] || "";
  
  pixelDialogTitle.textContent = story.title;
  pixelDialogStep.textContent = (storyState.stepIndex + 1) + " / " + story.lines.length;
  pixelDialogText.textContent = "";
  storyState.charIndex = 0;
  storyState.isTyping = true;
  pixelActionPrompt.textContent = "TYPING...";

  function typeChar() {
    if (!storyState.isTyping) return;
    if (storyState.charIndex < currentLine.length) {
      storyState.charIndex++;
      pixelDialogText.textContent = currentLine.slice(0, storyState.charIndex);
      storyState.timer = setTimeout(typeChar, 38);
    } else {
      storyState.isTyping = false;
      updatePromptStatus();
    }
  }
  typeChar();
}

function updatePromptStatus() {
  var story = getStoryForPhoto(storyState.photoIndex);
  if (storyState.stepIndex < story.lines.length - 1) {
    pixelActionPrompt.textContent = "NEXT ▼";
  } else {
    pixelActionPrompt.textContent = "FIN ■";
  }
}

function advanceStory() {
  var story = getStoryForPhoto(storyState.photoIndex);
  var currentLine = story.lines[storyState.stepIndex] || "";
  
  // 若正在打字中点击，直接瞬间完成当前段落（跳过打字动画）
  if (storyState.isTyping) {
    clearTimeout(storyState.timer);
    storyState.isTyping = false;
    pixelDialogText.textContent = currentLine;
    storyState.charIndex = currentLine.length;
    updatePromptStatus();
    return;
  }
  
  // 若当前段落已完成，且有下一段，推进到下一段
  if (storyState.stepIndex < story.lines.length - 1) {
    storyState.stepIndex++;
    renderStoryStep();
  }
  // 若已是最后一段，保持显示不作变动
}

// 绑定对话框点击推进
pixelDialog.addEventListener("click", function(e) {
  e.stopPropagation();
  advanceStory();
});
['pointerdown', 'pointerup', 'pointermove'].forEach(function(evt) {
  pixelDialog.addEventListener(evt, function(e) { e.stopPropagation(); });
});
```

---

## 5. 独立验证方法 (Verification Method)

后续实施代理可通过以下方式进行端到端独立验证：

1. **静态代码规范检查**：
   - 运行构建命令确认零语法错误与零打包异常：
     `npm run build`
   - 检查打包产物 `dist/gallery.html` 是否包含 `#pixelDialog` 及 `Press Start 2P` 样式。
2. **零音频红线验证**：
   - 运行 ripgrep 检查项目是否包含音频调用：
     `git grep -i "AudioContext" src/`
     `git grep -i "\.mp3" src/`
     `git grep -i "play(" src/`
     确认无任何音频资源引入。
3. **交互与状态机验证（浏览器环境）**：
   - 启动本地服务：`npm run dev`
   - 访问 `http://localhost:5173/gallery.html`；
   - 点击任意图片卡片：确认图片展开瞬间，底部浮现像素对话框，打字机自动逐字输出第一段文字；
   - 在打字过程中轻触对话框：确认文字瞬间完成补全，光标持续闪烁，提示变为 `NEXT ▼`；
   - 再次轻触对话框：确认清空并以打字机输出第二段文字，计数变为 `2 / 3`；
   - 再次轻触对话框输出第三段文字，打完后变为 `FIN ■`，文字常驻不消失；
   - 点击右上角关闭按钮或空白背景关闭灯箱：确认对话框立即隐藏，定时器销毁；
   - 重新点击另一张图片展开：确认对话框重置为该新图片的第 1 句，重新开始打字机播放。
4. **移动端响应式与防误触验证**：
   - 切换至移动端仿真（如 iPhone 14 Pro 393x852）：
   - 确认对话框紧贴安全区底部，尺寸自适应，字体与双层像素框清晰锐利，与居中的 16:9 照片无严重遮挡；
   - 点击对话框不会误触发背景关闭灯箱，也不会误触发双击放大镜头。
