import * as THREE from "three";
import Orchestrator from "../Orchestrator.js";

// Maximum number of trail points kept alive at once.
// Must match the literal "128" used in the vertex shader texture lookup.
const MAX_TRAIL = 128;

/**
 * MouseTrail
 *
 * Records a mouse trail in world space and uploads it every frame as a
 * MAX_TRAIL×1 RGBA float DataTexture.  Each texel encodes one trail point:
 *   .r = world X
 *   .g = world Z
 *   .b = age (seconds since the point was created)
 *   .a = unused
 *
 * The vertex shader in World.js reads this texture and, for every cube,
 * sums the wave contributions from each live trail point:
 *   - an outward-expanding Gaussian envelope centred on the wavefront
 *   - cosine oscillation relative to the wavefront position
 *   - exponential time-fade and 1/(1+dist) distance attenuation
 *
 * Public API
 * ----------
 *   uniforms  – object whose entries can be directly assigned to
 *               shader.uniforms inside onBeforeCompile
 *   params    – tweak { fadeTime, trailSpacing };
 *               GUI onChange handlers should also update
 *               the corresponding uniform.value (see World.js setGUI)
 *   update(delta)  – call once per frame with delta in seconds
 *   dispose()      – removes event listeners and frees the texture
 */
export default class MouseTrail {
    constructor(bounds) {
        this.orchestrator = new Orchestrator();
        this.camera = this.orchestrator.camera.instance;
        this.canvas = this.orchestrator.canvas;
        this.bounds = bounds;

        this.params = {
            fadeTime: 2.0, // seconds for amplitude to fall to ~37 %
            trailSpacing: 0.1, // minimum world-unit distance between trail points
        };

        this.trail = []; // [ { x, z, age } ]
        this.lastPoint = null;
        this.activePointers = new Map();
        this.lastTouchTrailTime = 0;

        // Removed random point logic
        this.timeSinceLastMove = 0;

        this.mouseCoords = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();

        // Invisible horizontal plane for pointer → world-space raycasting
        this.rayPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(bounds, bounds),
            new THREE.MeshBasicMaterial({
                side: THREE.DoubleSide,
                visible: false,
            }),
        );
        this.rayPlane.rotation.x = -Math.PI / 2;
        this.rayPlane.updateMatrixWorld(true);

        // DataTexture (MAX_TRAIL × 1, RGBA float): trail data for the shader
        this.trailData = new Float32Array(MAX_TRAIL * 4);
        this.trailTexture = new THREE.DataTexture(
            this.trailData,
            MAX_TRAIL,
            1,
            THREE.RGBAFormat,
            THREE.FloatType,
        );
        this.trailTexture.needsUpdate = true;

        // Uniform objects — assigned by reference in World.js onBeforeCompile
        // so mutations here are automatically reflected in the shader each frame.
        this._uniforms = {
            uTrailTexture: { value: this.trailTexture },
            uTrailCount: { value: 0 },
            uFadeTime: { value: this.params.fadeTime },
        };

        // Pointer event rect caching
        this.rect = this.canvas.getBoundingClientRect();
        this.orchestrator.sizes.emitter.on("resize", () => {
            this.rect = this.canvas.getBoundingClientRect();
        });

        this.bindPointerEvents();
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    get uniforms() {
        return this._uniforms;
    }

    /**
     * Age all trail points, prune expired ones, and upload the updated data
     * to the GPU texture.
     * @param {number} delta  Frame time in seconds.
     */
    update(delta) {
        // Points survive for fadeTime * 4 seconds; at that age the shader
        // fade factor exp(-4) ≈ 0.018 makes them visually negligible.
        const expiry = this.params.fadeTime * 4;

        for (let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].age += delta;
            if (this.trail[i].age > expiry) {
                this.trail.splice(i, 1);
            }
        }

        // Removed inactivity and random point logic

        // Upload the latest MAX_TRAIL live points to the texture
        const count = Math.min(this.trail.length, MAX_TRAIL);

        if (count > 0 || this._uniforms.uTrailCount.value > 0) {
            for (let i = 0; i < count; i++) {
                const ti = i * 4;
                this.trailData[ti] = this.trail[i].x;
                this.trailData[ti + 1] = this.trail[i].z;
                this.trailData[ti + 2] = this.trail[i].age;
                this.trailData[ti + 3] = this.trail[i].distDelta;
            }
            this.trailTexture.needsUpdate = true;
            this._uniforms.uTrailCount.value = count;
        }
    }

    dispose() {
        this.canvas.removeEventListener("pointermove", this.onPointerMove);
        if (this.onPointerDown) {
            this.canvas.removeEventListener("pointerdown", this.onPointerDown);
        }
        if (this.onPointerUp) {
            this.canvas.removeEventListener("pointerup", this.onPointerUp);
            this.canvas.removeEventListener("pointercancel", this.onPointerUp);
        }
        this.trailTexture.dispose();
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    addWavePoint(clientX, clientY, distDelta = 1.0) {
        this.mouseCoords.set(
            ((clientX - this.rect.left) / this.rect.width) * 2 - 1,
            -((clientY - this.rect.top) / this.rect.height) * 2 + 1,
        );

        this.raycaster.setFromCamera(this.mouseCoords, this.camera);
        const hits = this.raycaster.intersectObject(this.rayPlane);
        if (hits.length === 0) return null;

        const { x, z } = hits[0].point;

        if (this.trail.length >= MAX_TRAIL) {
            this.trail.shift();
        }

        this.trail.push({ x, z, age: 0, distDelta });
        this.lastPoint = { x, z };
        return { x, z };
    }

    bindPointerEvents() {
        this.onPointerDown = (e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            if (this.orchestrator.camera.pointers.size > 1) return;

            this.activePointers.set(e.pointerId, {
                startX: e.clientX,
                startY: e.clientY,
                startTime: performance.now(),
                maxDist: 0,
                pointerType: e.pointerType,
            });

            // Desktop mouse click creates a wave immediately
            if (e.pointerType === "mouse") {
                this.addWavePoint(e.clientX, e.clientY, 1.0);
            }
        };

        this.onPointerMove = (e) => {
            if (this.orchestrator.camera.pointers.size > 1) return;

            // Decouple touch perspective dragging from water ripple generation
            if (e.pointerType === "touch") {
                const info = this.activePointers.get(e.pointerId);
                if (info) {
                    const distFromStart = Math.hypot(e.clientX - info.startX, e.clientY - info.startY);
                    info.maxDist = Math.max(info.maxDist, distFromStart);
                }

                // If user is dragging (perspective orbit), throttle wave emission frequency and magnitude
                const now = performance.now();
                if (now - this.lastTouchTrailTime < 280) return;

                this.mouseCoords.set(
                    ((e.clientX - this.rect.left) / this.rect.width) * 2 - 1,
                    -((e.clientY - this.rect.top) / this.rect.height) * 2 + 1,
                );
                this.raycaster.setFromCamera(this.mouseCoords, this.camera);
                const hits = this.raycaster.intersectObject(this.rayPlane);
                if (hits.length === 0) return;

                const { x, z } = hits[0].point;
                if (this.lastPoint) {
                    const dx = x - this.lastPoint.x;
                    const dz = z - this.lastPoint.z;
                    const distDelta = Math.sqrt(dx * dx + dz * dz);
                    if (distDelta < 1.5) return;
                }

                // Keep touch drag trail points strictly bounded (<= 16) to avoid 128-point blowout
                if (this.trail.length >= 16) {
                    this.trail.shift();
                }

                this.trail.push({ x, z, age: 0, distDelta: 0.2 });
                this.lastPoint = { x, z };
                this.lastTouchTrailTime = now;
                return;
            }

            // Desktop mouse hover trail
            this.mouseCoords.set(
                ((e.clientX - this.rect.left) / this.rect.width) * 2 - 1,
                -((e.clientY - this.rect.top) / this.rect.height) * 2 + 1,
            );

            this.raycaster.setFromCamera(this.mouseCoords, this.camera);
            const hits = this.raycaster.intersectObject(this.rayPlane);
            if (hits.length === 0) return;

            const { x, z } = hits[0].point;

            let distDelta = 0;
            if (this.lastPoint) {
                const dx = x - this.lastPoint.x;
                const dz = z - this.lastPoint.z;
                distDelta = Math.sqrt(dx * dx + dz * dz);
                if (distDelta < this.params.trailSpacing) return;
            }

            if (this.trail.length >= MAX_TRAIL) {
                this.trail.shift();
            }

            this.trail.push({ x, z, age: 0, distDelta });
            this.lastPoint = { x, z };
        };

        this.onPointerUp = (e) => {
            const info = this.activePointers.get(e.pointerId);
            if (info && info.pointerType === "touch") {
                const duration = performance.now() - info.startTime;
                const dist = Math.hypot(e.clientX - info.startX, e.clientY - info.startY);
                // Tap detected (短促轻触): duration < 350ms, displacement < 18px
                if (duration < 350 && dist < 18 && info.maxDist < 18) {
                    this.addWavePoint(e.clientX, e.clientY, 1.0);
                }
            }
            this.activePointers.delete(e.pointerId);
        };

        this.canvas.addEventListener("pointerdown", this.onPointerDown);
        this.canvas.addEventListener("pointermove", this.onPointerMove);
        this.canvas.addEventListener("pointerup", this.onPointerUp);
        this.canvas.addEventListener("pointercancel", this.onPointerUp);
    }

    // addRandomPoint removed
}
