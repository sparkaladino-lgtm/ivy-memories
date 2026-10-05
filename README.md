# Ivy Memories

[**🇨🇳 中文版 (Chinese)**](./README_zh.md)

**Live Demo:** [https://sparkaladino-lgtm.github.io/ivy-memories/](https://sparkaladino-lgtm.github.io/ivy-memories/)

This is a commemorative interactive 3D showcase specially designed and developed to celebrate Ivy Lawson's birthday on October 21st. 

Built on a modern WebGL tech stack, the project constructs an immersive, dream-like 3D memory gallery. Users can explore visual slices of Ivy's memories and experience a unique narrative journey across time and space.

## 🚀 Tech Stack & Architecture

This project is built from scratch without relying on heavy UI frameworks (like React/Vue), focusing entirely on high-performance native WebGL and pure DOM manipulation for maximum efficiency.

- **WebGL Rendering Engine:** [Three.js](https://threejs.org/)
  - Powers the entire 3D scene, cameras, meshes, and texture mapping.
- **Custom Shader Programming:** GLSL (OpenGL Shading Language)
  - Custom Vertex & Fragment shaders handle the interactive wave grid distortion, chromatic aberration (RGB color splitting), and the optical glass refraction effects inside the memory lens.
- **Animation Engine:** [GSAP](https://gsap.com/) (GreenSock Animation Platform)
  - Manages complex cinematic timelines, smooth 3D camera panning, and fluid transitions between the gallery overview and focused memory fragments.
- **Build Tool:** [Vite](https://vitejs.dev/)
  - Provides lightning-fast Hot Module Replacement (HMR) during development and highly optimized rollup bundling for production.
- **Audio Synthesis:** Web Audio API (`AudioContext`)
  - Generates raw oscillator waveforms (Triangle waves) programmatically to create the retro 8-bit typewriter sound effects on the fly, eliminating the need for external audio asset loading.
- **Styling & Responsive Design:** Pure CSS3
  - Utilizes CSS variables, flexbox, and strict media queries to ensure pixel-perfect rendering across 4K desktop monitors, tablets, and ultra-narrow mobile screens. Integrates the `Press Start 2P` font for retro RPG dialogue aesthetics.

## ✨ Core Features

1. **Interactive 3D Memory Grid**: A dynamic fluid matrix where mouse or touch movements generate real-time reactive wave trails on the underlying mesh.
2. **Optical Lens Gallery**: Clicking on a memory fragment morphs it into a magnifying lens, utilizing custom GLSL shaders to bend light and create physical glass refraction.
3. **Immersive Typewriter Narrative**: While viewing a memory, an RPG-style pixelated dialog box types out Ivy's inner monologues character by character, accompanied by synchronized synthesized audio feedback. Click/tap to instantly complete or advance the text.

---

## 🛠 Usage & Deployment

### 1. Prerequisites
Ensure [Node.js](https://nodejs.org/) (latest LTS) is installed on your system.

### 2. Download Source
```bash
git clone https://github.com/sparkaladino-lgtm/ivy-memories.git
cd ivy-memories
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Local Development Server
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser. The scene will auto-refresh upon code changes.

### 5. Production Build
```bash
npm run build
```
Generates a highly compressed `dist` folder ready to be deployed to GitHub Pages, Vercel, or any static hosting platform.
