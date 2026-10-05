import * as THREE from "three";
import Orchestrator from "./Orchestrator.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { VignetteRGBShiftShader } from "./Effects/VignetteRGBShiftShader.js";

export default class Renderer {
    constructor() {
        this.orchestrator = new Orchestrator();
        this.canvas = this.orchestrator.canvas;
        this.sizes = this.orchestrator.sizes;
        this.scene = this.orchestrator.scene;
        this.camera = this.orchestrator.camera;

        this.isMobile = this.checkMobile();

        this.setInstance();
        this.setupMobileVignetteOverlay();
        this.setPostProcessing();
        this.setGUI();
    }

    checkMobile() {
        if (typeof window === "undefined") return false;
        return (
            window.matchMedia("(pointer: coarse)").matches ||
            window.innerWidth <= 768 ||
            "ontouchstart" in window ||
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
        );
    }

    setupMobileVignetteOverlay() {
        if (typeof document === "undefined") return;
        let overlay = document.getElementById("mobile-vignette-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "mobile-vignette-overlay";
            Object.assign(overlay.style, {
                position: "fixed",
                top: "0",
                left: "0",
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: "1",
                background:
                    "radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.08) 72%, rgba(0, 0, 0, 0.28) 100%)",
                boxShadow:
                    "inset 0 0 70px rgba(0, 0, 0, 0.25), inset 2px 2px 25px rgba(255, 0, 80, 0.04), inset -2px -2px 25px rgba(0, 150, 255, 0.04)",
                transition: "opacity 0.3s ease",
            });
            document.body.appendChild(overlay);
        }
        this.mobileVignetteOverlay = overlay;
        this.updateOverlayVisibility();
    }

    updateOverlayVisibility() {
        if (this.mobileVignetteOverlay) {
            this.mobileVignetteOverlay.style.display = this.isMobile
                ? "block"
                : "none";
        }
    }

    setInstance() {
        this.instance = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
        });
        this.instance.toneMapping = THREE.ACESFilmicToneMapping;
        this.instance.toneMappingExposure = 1.95;
        this.instance.outputColorSpace = THREE.SRGBColorSpace;
        this.instance.shadowMap.enabled = true;
        this.instance.shadowMap.type = THREE.PCFShadowMap;
        this.instance.setClearColor("#808080");
        this.instance.setSize(this.sizes.width, this.sizes.height);
        // 限制最大设备像素比为 2，防止超高密屏四倍渲染过载
        this.instance.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }

    setPostProcessing() {
        this.composer = new EffectComposer(this.instance);
        this.renderPass = new RenderPass(this.scene, this.camera.instance);
        this.composer.addPass(this.renderPass);

        this.vignetteRGBShiftPass = new ShaderPass(VignetteRGBShiftShader);
        this.vignetteRGBShiftPass.uniforms.shiftAmount.value = 0.005; // Adjust the intensity of the RGB shift
        this.vignetteRGBShiftPass.uniforms.vignetteRadius.value = 0.3; // Adjust where the effect starts (0.0 to 1.0)
        this.vignetteRGBShiftPass.uniforms.vignetteSoftness.value = 0.3; // Adjust the falloff smoothness of the effect
        this.composer.addPass(this.vignetteRGBShiftPass);

        this.outputPass = new OutputPass();
        this.composer.addPass(this.outputPass);
    }

    setGUI() {
        this.gui = this.orchestrator.debug.ui;
        if (!this.gui) return;

        // 渲染管线模式监控与切换调试
        const pipeFolder = this.gui.addFolder("Rendering Pipeline");
        const pipeState = {
            mode: this.isMobile
                ? "Mobile Direct (CSS Overlay)"
                : "Desktop Composer",
            forceDirectRender: false,
        };
        pipeFolder
            .add(pipeState, "mode")
            .name("Active Pipeline")
            .listen()
            .disable();
        pipeFolder
            .add(pipeState, "forceDirectRender")
            .name("Force Direct Render")
            .onChange((val) => {
                this.isMobile = val || this.checkMobile();
                pipeState.mode = this.isMobile
                    ? "Mobile Direct (CSS Overlay)"
                    : "Desktop Composer";
                this.updateOverlayVisibility();
            });

        // 桌面端全功能后处理控制
        const ppFolder = this.gui.addFolder("Post Processing");
        ppFolder
            .add(
                this.vignetteRGBShiftPass.uniforms.shiftAmount,
                "value",
                0,
                0.02,
                0.001,
            )
            .name("Shift Amount");
        ppFolder
            .add(
                this.vignetteRGBShiftPass.uniforms.vignetteRadius,
                "value",
                0,
                1,
                0.01,
            )
            .name("Vignette Radius");
        ppFolder
            .add(
                this.vignetteRGBShiftPass.uniforms.vignetteSoftness,
                "value",
                0,
                1,
                0.01,
            )
            .name("Vignette Softness");
    }

    resize() {
        const wasMobile = this.isMobile;
        this.isMobile = this.checkMobile();
        if (wasMobile !== this.isMobile) {
            this.updateOverlayVisibility();
        }

        const maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        this.instance.setSize(this.sizes.width, this.sizes.height);
        this.instance.setPixelRatio(maxPixelRatio);

        if (this.composer && !this.isMobile) {
            this.composer.setSize(this.sizes.width, this.sizes.height);
            this.composer.setPixelRatio(maxPixelRatio);
        }
    }

    update() {
        // 移动端自适应轻量直出模式：跳过多重离屏 Pass，彻底消除显存带宽挤占，保障流畅 60FPS
        if (this.isMobile) {
            this.instance.render(this.scene, this.camera.instance);
        } else {
            // 桌面端保留全功能 EffectComposer 后期通道
            this.composer.render();
        }
    }
}
