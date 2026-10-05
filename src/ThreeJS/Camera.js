import * as THREE from "three";
import Orchestrator from "./Orchestrator.js";

export default class Camera {
    constructor() {
        this.orchestrator = new Orchestrator();
        this.sizes = this.orchestrator.sizes;
        this.scene = this.orchestrator.scene;
        this.canvas = this.orchestrator.canvas;

        // Orbit parameters
        this.radius = 22;
        this.zoom = 1;
        this.isTouch = window.matchMedia("(pointer: coarse)").matches;
        this.pointers = new Map();
        this.isDragging = false;
        this.pointerDownPos = { x: 0, y: 0 };
        this.pointerDownTime = 0;
        this.dragDistance = 0;

        // Max mouse influence in radians
        // mouse Y → rotation around X axis (up/down tilt)
        // mouse X → rotation around Z axis (left/right orbit)
        this.alphaRange = Math.PI * 0.05; // ±~14° around X
        this.betaRange = Math.PI * 0.05; // ±~22° around Z

        // Normalized mouse [-1, 1] and its lerped counterpart
        this.mouse = new THREE.Vector2(0, 0);
        this.lerpedMouse = new THREE.Vector2(0, 0);

        this.setInstance();
        this.setMouseListener();
        this.setGUI();
    }

    setInstance() {
        this.instance = new THREE.PerspectiveCamera(
            40,
            this.sizes.width / this.sizes.height,
            0.1,
            200,
        );
        this.fitViewport();
        this._updatePosition(0, 0);
        this.scene.add(this.instance);
    }

    setMouseListener() {
        const pinchDistance = () => {
            const [a, b] = [...this.pointers.values()];
            return Math.hypot(a.x - b.x, a.y - b.y);
        };
        this.canvas.addEventListener("pointerdown", (e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            this.canvas.setPointerCapture(e.pointerId);
            if (this.pointers.size === 1) {
                this.pointerDownPos = { x: e.clientX, y: e.clientY };
                this.pointerDownTime = performance.now();
                this.dragDistance = 0;
                this.isDragging = false;
            }
            if (this.pointers.size === 2) this.pinchStart = pinchDistance();
        });
        const endPointer = (e) => {
            this.pointers.delete(e.pointerId);
            if (this.pointers.size === 0) {
                this.isDragging = false;
                this.dragDistance = 0;
            }
            this.pinchStart = null;
        };
        for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
            this.canvas.addEventListener(event, endPointer);
        }
        window.addEventListener("blur", () => {
            this.pointers.clear();
            this.isDragging = false;
        });
        this.canvas.addEventListener("pointermove", (e) => {
            const previous = this.pointers.get(e.pointerId);
            if (!previous) return;
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this.pointers.size === 2) {
                const distance = pinchDistance();
                if (this.pinchStart > 0 && distance > 0) {
                    this.zoom = THREE.MathUtils.clamp(this.zoom * this.pinchStart / distance, 0.8, 1.6);
                    this.radius = this.fitRadius * this.zoom;
                }
                this.pinchStart = distance;
                return;
            }
            if (this.pointers.size !== 1) return;

            const dx = e.clientX - this.pointerDownPos.x;
            const dy = e.clientY - this.pointerDownPos.y;
            this.dragDistance = Math.hypot(dx, dy);
            if (this.dragDistance > 8) {
                this.isDragging = true;
            }

            const sensitivity = this.isTouch ? 4 : 15;
            const limit = this.isTouch ? 1 : Infinity;
            this.mouse.x = THREE.MathUtils.clamp(this.mouse.x + (e.clientX - previous.x) / this.sizes.width * sensitivity, -limit, limit);
            this.mouse.y = THREE.MathUtils.clamp(this.mouse.y - (e.clientY - previous.y) / this.sizes.height * sensitivity, -limit, limit);
        });
        this.canvas.addEventListener("wheel", (e) => {
            e.preventDefault();
            if (!this.isTouch) {
                this.radius = THREE.MathUtils.clamp(this.radius + e.deltaY * 0.02, 10, 60);
                this.zoom = this.radius / this.fitRadius;
                return;
            }
            this.zoom = THREE.MathUtils.clamp(this.zoom + e.deltaY * 0.001, 0.8, 1.6);
            this.radius = this.fitRadius * this.zoom;
        }, { passive: false });
    }

    fitViewport() {
        if (!this.isTouch && this.sizes.width > 768) {
            this.fitRadius = 22;
            this.radius = this.fitRadius * this.zoom;
            return;
        }
        // Reserve space for the title and footer, including short landscape screens.
        const aspect = this.sizes.width / this.sizes.height;
        const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(this.instance.fov / 2));
        const availableHeight = this.isTouch ? 0.62 : 0.85;
        const width = 32 * 0.81;
        const depth = 18 * 0.81;
        this.fitRadius = Math.max(22, width / (2 * tanHalfFov * aspect * 0.88), depth / (2 * tanHalfFov * availableHeight)) + 1.5;
        this.radius = this.fitRadius * this.zoom;
    }

    _updatePosition(mx, my) {
        // α: rotation around X axis (mouse Y). Added base tilt for 3D effect.
        const alpha = my * this.alphaRange + Math.PI * 0.03; 
        const beta = mx * this.betaRange;

        // Start at (0, r, 0), apply X rotation then Z rotation:
        // After X: (0, r·cosα, r·sinα)
        // After Z: (-r·cosα·sinβ, r·cosα·cosβ, r·sinα)
        this.instance.position.set(
            -this.radius * Math.cos(alpha) * Math.sin(beta),
            this.radius * Math.cos(alpha) * Math.cos(beta),
            this.radius * Math.sin(alpha),
        );
        this.instance.up.set(0, 0, -1);
        this.instance.lookAt(0, 0, 0);
    }

    resize() {
        this.instance.aspect = this.sizes.width / this.sizes.height;
        this.instance.updateProjectionMatrix();
        this.fitViewport();
        this._updatePosition(this.lerpedMouse.x, this.lerpedMouse.y);
    }

    update(delta = 1 / 60) {
        // Lerp mouse toward actual cursor position
        const damping = 1 - Math.exp(-2.45 * delta);
        this.lerpedMouse.lerp(this.mouse, damping);
        this._updatePosition(this.lerpedMouse.x, this.lerpedMouse.y);
        // this.controls.update();
    }

    setGUI() {
        this.gui = this.orchestrator.debug.ui;
        if (!this.gui) return;
        const camFolder = this.gui.addFolder("Camera");

        camFolder.add(this, "radius", 5, 60, 0.01).name("Distance");
    }
}
