import * as THREE from "three";
import Stats from "stats.js";

import Debug from "./Utils/Debug.js";
import Sizes from "./Utils/Sizes.js";
import Camera from "./Camera.js";
import Renderer from "./Renderer.js";
import Stage from "./Stage.js";

let instance = null;

export default class Orchestrator {
    constructor(_canvas) {
        // Singleton
        if (instance) {
            return instance;
        }
        instance = this;

        // Options
        this.canvas = _canvas;

        // Setup
        this.debug = new Debug();
        this.sizes = new Sizes();
        this.scene = new THREE.Scene();
        this.camera = new Camera();
        this.renderer = new Renderer();
        this.clock = new THREE.Timer();
        // this makes use of the Page Visibility API to avoid large time delta values when the app is inactive (e.g. tab switched or browser hidden).
        this.clock.connect(document);

        // The main stage of the threejs experience,
        // where the bulk of your scene objects and logic will live.
        this.stage = new Stage();

        // Stats
        if (this.debug.active) {
            this.stats = new Stats();
            this.stats.showPanel(0); // 0: FPS, 1: MS, 2: MB
            this.stats.dom.style.left = "0px";
            this.stats.dom.style.top = "0px";
            document.body.appendChild(this.stats.dom);
        }

        // Resize event
        this.sizes.emitter.on("resize", () => {
            this.resize();
        });

        // Setup the animation loop
        // Always define the animation loop with this method and not manually with requestAnimationFrame() for best compatibility.
        this.renderer.instance.setAnimationLoop(this.animate.bind(this));
    }

    resize() {
        this.camera.resize();
        this.renderer.resize();
    }

    animate() {
        this.clock.update();

        // get the time delta and elapsed time in seconds
        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsed();

        this.update(elapsed, delta);
    }

    update(elapsed, delta) {
        if (this.debug.active) this.stats.begin();
        this.camera.update(delta);
        this.stage.update(delta);
        this.renderer.update();
        if (this.debug.active) this.stats.end();
    }

    destroy() {
        this.clock.disconnect();
        this.clock.dispose();
        this.sizes.emitter.off("resize");

        // Traverse the whole scene
        this.scene.traverse((child) => {
            // Test if it's a mesh
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();

                // Loop through the material properties
                for (const key in child.material) {
                    const value = child.material[key];

                    // Test if there is a dispose function
                    if (value && typeof value.dispose === "function") {
                        value.dispose();
                    }
                }
            }
        });

        if (this.camera.controls && typeof this.camera.controls.dispose === "function") {
            this.camera.controls.dispose();
        }
        this.renderer.instance.dispose();

        if (this.debug.active) this.debug.ui.destroy();
    }
}
