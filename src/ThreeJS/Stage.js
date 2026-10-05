import * as THREE from "three";
import GUI from "lil-gui";
import Orchestrator from "./Orchestrator.js";
import MouseTrail from "./Effects/MouseTrail.js";

export default class Stage {
    constructor() {
        this.orchestrator = new Orchestrator();
        this.scene = this.orchestrator.scene;

        this.gridCols = 32;
        this.gridRows = 18;
        this.cubeWidth = 0.8;
        this.cubeHeight = 3;
        this.params = {
            gap: 0.01,
            waveAmplitude: 0.4,
            waveSpeed: 2.5, // world units / second
            waveFrequency: 1.2, // radians / world unit (spatial oscillation)
            waveWidth: 3.0, // Gaussian half-width of the wave ring (world units)
            waveJitter: 0.2,
            waveMaxHeight: 0.4,
            colorBase: "#ffffff",
            colorHigh: "#8877ff",
        };
        this.scene.background = new THREE.Color("#f5f0ea"); // pearl white

        this.lightingParams = {
            ambientColor: "#ffffff",
            ambientIntensity: 0.5,
            directionalColor: "#ffffff",
            directionalIntensity: 4.0,
            directional2Color: "#ffffff",
            directional2Intensity: 1.0,
        };

        // Physical world-unit footprint of the grid
        this.bounds = new THREE.Vector2(
            this.gridCols * (this.cubeWidth + this.params.gap),
            this.gridRows * (this.cubeWidth + this.params.gap)
        );

        this.shaderRef = null;

        // 移动端自适应检测：触屏或小屏幕判定
        this.isTouch =
            typeof window !== "undefined" &&
            (window.matchMedia("(pointer: coarse)").matches ||
                window.innerWidth <= 768 ||
                "ontouchstart" in window ||
                (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
        // 移动端轨迹点采样上限自适应降为 32（暴降 75% 顶点着色器循环），桌面端为 128
        this.maxTrailCount = this.isTouch ? 32 : 128;

        const textureLoader = new THREE.TextureLoader();
        const baseUrl = import.meta.env.BASE_URL || "./";
        const webpUrl = `${baseUrl}image.webp`;
        const pngUrl = `${baseUrl}image.png`;

        this.imageTexture = textureLoader.load(
            webpUrl,
            (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                if (this.shaderRef && this.shaderRef.uniforms.uImage) {
                    this.shaderRef.uniforms.uImage.value = texture;
                }
            }
        );
        this.imageTexture.colorSpace = THREE.SRGBColorSpace;

        this.setLighting();
        this.setGrid();
        this.mouseTrail = new MouseTrail(Math.max(this.bounds.x, this.bounds.y));
        this.setGUI();
    }

    setLighting() {
        const lp = this.lightingParams;

        this.ambientLight = new THREE.AmbientLight(
            lp.ambientColor,
            lp.ambientIntensity,
        );
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(
            lp.directionalColor,
            lp.directionalIntensity,
        );
        this.directionalLight.position.set(-20, 10, 6);
        this.directionalLight.castShadow = true;
        // 移动端深度 pass 自适应优化：阴影贴图设为 512x512，像素渲染带宽节省 75%，桌面端保留 1024x1024
        const shadowMapRes = this.isTouch ? 512 : 1024;
        this.directionalLight.shadow.mapSize.set(shadowMapRes, shadowMapRes);
        this.directionalLight.shadow.radius = 6;
        this.directionalLight.shadow.camera.near = 0.1;
        this.directionalLight.shadow.camera.far = 60;
        this.directionalLight.shadow.camera.left = -22;
        this.directionalLight.shadow.camera.right = 22;
        this.directionalLight.shadow.camera.top = 22;
        this.directionalLight.shadow.camera.bottom = -22;
        this.directionalLight.shadow.bias = 0.0001;
        this.scene.add(this.directionalLight);

        this.directionalLight2 = new THREE.DirectionalLight(
            lp.directional2Color,
            lp.directional2Intensity,
        );
        this.directionalLight2.position.set(10, 5, -3);
        this.directionalLight2.castShadow = false;
        this.scene.add(this.directionalLight2);

        // Add camera helper to visualize shadow camera frustum
        this.shadowCameraHelper = new THREE.CameraHelper(
            this.directionalLight.shadow.camera,
        );
        this.shadowCameraHelper.visible = false;
        this.scene.add(this.shadowCameraHelper);
    }

    // This is shared between the main shader and the depth shader to ensure consistent wave deformation in both passes.
    // 移动端自适应优化：主 pass 采样上限降为 32，深度 pass 采样上限降为 16 并精简 Jitter 哈希，桌面端维持 128
    overrideVertexShader(vertexShader, isDepth = false) {
        const maxSteps = this.isTouch ? (isDepth ? 16 : 32) : 128;
        const skipJitterInDepth = isDepth && this.isTouch;

        return vertexShader
            .replace(
                "#include <common>",
                `#include <common>
                #define MAX_TRAIL_STEPS ${maxSteps}
                varying float vHeight;
                varying vec2 vUv;
                attribute vec2 aOffset;
                uniform sampler2D uTrailTexture;
                uniform int       uTrailCount;
                uniform float     uWaveSpeed;
                uniform float     uWaveFreq;
                uniform float     uWaveWidth;
                uniform float     uFadeTime;
                uniform float     uAmplitude;
                uniform float     uJitter;
                uniform float     uMaxHeight;
                uniform vec2      uBounds;

                // Deterministic per-instance hash → two values in [-0.5, 0.5].
                // Stable across frames; depends only on world position.
                vec2 hash2( vec2 p ) {
                    p = vec2(
                        dot( p, vec2( 127.1, 311.7 ) ),
                        dot( p, vec2( 269.5, 183.3 ) )
                    );
                    return fract( sin( p ) * 43758.5453123 ) - 0.5;
                }`,
            )
            .replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>

                vHeight = 0.0;
                // Calculate continuous UV using both instance offset and local vertex position
                vUv = vec2(aOffset.x + position.x, -(aOffset.y + position.z)) / uBounds + 0.5;

                if ( position.y > 0.0 ) {
                    ${
                        skipJitterInDepth
                            ? `vec2 worldXZ = aOffset;`
                            : `vec2 jitter  = hash2( aOffset ) * uJitter;
                    vec2 worldXZ = aOffset + jitter;`
                    }
                    float waveHeight  = 0.0;
                    float totalWeight = 0.0;
                    int loopCount = min(uTrailCount, MAX_TRAIL_STEPS);

                    for ( int i = 0; i < MAX_TRAIL_STEPS; i++ ) {
                        if ( i >= loopCount ) break;
                        // texel layout: (worldX, worldZ, age, distDelta)
                        vec4 td = texture2D(
                            uTrailTexture,
                            vec2( ( float(i) + 0.5 ) / 128.0, 0.5 )
                        );
                        float dist      = length( worldXZ - td.rg );
                        float wavefront = uWaveSpeed * td.b;
                        float relDist   = dist - wavefront;

                        // Gaussian envelope centred on the expanding wavefront
                        float window = exp( -( relDist * relDist ) / ( uWaveWidth * uWaveWidth ) );
                        // Exponential time-fade + distance attenuation
                        float fade   = exp( -td.b / uFadeTime );
                        float atten  = 1.0 / ( 1.0 + dist * 0.1 );
                        float weight = fade * window * atten * td.a; // td.a is distDelta, used to weaken waves from closely spaced trail points

                        waveHeight  += weight * cos( uWaveFreq * relDist );
                        totalWeight += weight;
                    }

                    // Weighted average: overlapping waves average rather than stack,
                    // cancelling chaotic superposition while preserving single-wave peaks.
                    waveHeight /= max( totalWeight, 1.0 );

                    float displacement = clamp( waveHeight * uAmplitude, -uMaxHeight, uMaxHeight );
                    transformed.y += displacement;
                    vHeight = displacement;
                }`,
            );
    }

    setGrid() {
        const count = this.gridCols * this.gridRows;
        const geometry = new THREE.BoxGeometry(
            this.cubeWidth,
            this.cubeHeight,
            this.cubeWidth,
        );

        // Per-instance XZ world position passed to the vertex shader
        this.offsetAttribute = new THREE.InstancedBufferAttribute(
            new Float32Array(count * 2),
            2,
        );
        geometry.setAttribute("aOffset", this.offsetAttribute);

        const material = new THREE.MeshPhongMaterial({ color: 0xffffff });

        material.onBeforeCompile = (shader) => {
            // Attach trail-wave uniforms by reference so MouseTrail.update()
            // mutations are automatically reflected each frame without extra work here.
            const mu = this.mouseTrail.uniforms;
            shader.uniforms.uTrailTexture = mu.uTrailTexture;
            shader.uniforms.uTrailCount = mu.uTrailCount;
            shader.uniforms.uFadeTime = mu.uFadeTime;
            shader.uniforms.uWaveSpeed = { value: this.params.waveSpeed };
            shader.uniforms.uWaveFreq = { value: this.params.waveFrequency };
            shader.uniforms.uWaveWidth = { value: this.params.waveWidth };
            shader.uniforms.uAmplitude = { value: this.params.waveAmplitude };
            shader.uniforms.uJitter = { value: this.params.waveJitter };
            shader.uniforms.uMaxHeight = { value: this.params.waveMaxHeight };
            shader.uniforms.uColorBase = {
                value: new THREE.Color(this.params.colorBase),
            };
            shader.uniforms.uColorHigh = {
                value: new THREE.Color(this.params.colorHigh),
            };
            shader.uniforms.uImage = { value: this.imageTexture };
            shader.uniforms.uBounds = { value: this.bounds };

            shader.vertexShader = this.overrideVertexShader(
                shader.vertexShader,
                false,
            );

            shader.fragmentShader = shader.fragmentShader
                .replace(
                    "#include <common>",
                    `#include <common>
                    varying float vHeight;
                    varying vec2 vUv;
                    uniform sampler2D uImage;
                    uniform vec3  uColorBase;
                    uniform vec3  uColorHigh;
                    uniform float uMaxHeight;`,
                )
                .replace(
                    "#include <color_fragment>",
                    `#include <color_fragment>
                    vec4 texColor = texture2D(uImage, vUv);
                    float t = clamp( vHeight / uMaxHeight, 0.0, 1.0 );
                    // Derive wave color from the local pixel: brighten + boost saturation
                    vec3 brightened = clamp(texColor.rgb * 1.6 + vec3(0.25), 0.0, 1.0);
                    // Slightly push toward the pixel's dominant channel for richer color
                    vec3 waveColor = mix(brightened, brightened * 1.3, 0.4);
                    waveColor = clamp(waveColor, 0.0, 1.0);
                    diffuseColor.rgb = mix(texColor.rgb, waveColor, t);`,
                );

            this.shaderRef = shader;
        };

        const depthMaterial = new THREE.MeshDepthMaterial();

        depthMaterial.onBeforeCompile = (shader) => {
            const mu = this.mouseTrail.uniforms;
            shader.uniforms.uTrailTexture = mu.uTrailTexture;
            shader.uniforms.uTrailCount = mu.uTrailCount;
            shader.uniforms.uFadeTime = mu.uFadeTime;
            shader.uniforms.uWaveSpeed = { value: this.params.waveSpeed };
            shader.uniforms.uWaveFreq = { value: this.params.waveFrequency };
            shader.uniforms.uWaveWidth = { value: this.params.waveWidth };
            shader.uniforms.uAmplitude = { value: this.params.waveAmplitude };
            shader.uniforms.uJitter = { value: this.params.waveJitter };
            shader.uniforms.uMaxHeight = { value: this.params.waveMaxHeight };
            shader.uniforms.uBounds = { value: this.bounds };

            // 深度 pass 顶点优化：isDepth 为 true
            shader.vertexShader = this.overrideVertexShader(
                shader.vertexShader,
                true,
            );
        };

        this.instancedMesh = new THREE.InstancedMesh(geometry, material, count);
        this.instancedMesh.customDepthMaterial = depthMaterial;
        this.instancedMesh.castShadow = true;
        this.instancedMesh.receiveShadow = true;
        this.scene.add(this.instancedMesh);
        this.updateGrid();
    }

    updateGrid() {
        const dummy = new THREE.Object3D();
        const spacing = this.cubeWidth + this.params.gap;
        const offsetX = ((this.gridCols - 1) * spacing) / 2;
        const offsetZ = ((this.gridRows - 1) * spacing) / 2;

        for (let i = 0; i < this.gridCols; i++) {
            for (let j = 0; j < this.gridRows; j++) {
                const index = i * this.gridRows + j;
                const x = i * spacing - offsetX;
                const z = j * spacing - offsetZ;
                dummy.position.set(x, 0, z);
                dummy.updateMatrix();
                this.instancedMesh.setMatrixAt(index, dummy.matrix);
                this.offsetAttribute.setXY(index, x, z);
            }
        }
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.offsetAttribute.needsUpdate = true;
    }

    setGUI() {
        this.gui = this.orchestrator.debug.ui;
        if (!this.gui) return;

        this.gui
            .add(this.params, "gap", 0, 1, 0.01)
            .name("Gap")
            .onChange(() => this.updateGrid());

        this.gui
            .add(this.params, "waveAmplitude", 0, 10, 0.01)
            .name("Wave Amplitude")
            .onChange(() => {
                if (this.shaderRef)
                    this.shaderRef.uniforms.uAmplitude.value =
                        this.params.waveAmplitude;
            });

        this.gui
            .add(this.params, "waveSpeed", 1, 20, 0.1)
            .name("Wave Speed")
            .onChange((v) => {
                if (this.shaderRef) {
                    this.shaderRef.uniforms.uWaveSpeed.value = v;
                }
            });

        this.gui
            .add(this.params, "waveFrequency", 0.1, 5, 0.05)
            .name("Wave Frequency")
            .onChange((v) => {
                if (this.shaderRef) {
                    this.shaderRef.uniforms.uWaveFreq.value = v;
                }
            });

        this.gui
            .add(this.params, "waveWidth", 0.5, 10, 0.1)
            .name("Wave Width")
            .onChange((v) => {
                if (this.shaderRef) {
                    this.shaderRef.uniforms.uWaveWidth.value = v;
                }
            });

        this.gui
            .add(this.params, "waveMaxHeight", 0, this.cubeHeight, 0.05)
            .name("Wave Max Height")
            .onChange(() => {
                if (this.shaderRef)
                    this.shaderRef.uniforms.uMaxHeight.value =
                        this.params.waveMaxHeight;
            });

        this.gui
            .add(this.params, "waveJitter", 0, 2, 0.01)
            .name("Wave Jitter")
            .onChange(() => {
                if (this.shaderRef)
                    this.shaderRef.uniforms.uJitter.value =
                        this.params.waveJitter;
            });

        this.gui
            .addColor(this.params, "colorBase")
            .name("Base Color")
            .onChange((v) => {
                if (this.shaderRef)
                    this.shaderRef.uniforms.uColorBase.value.set(v);
            });

        this.gui
            .addColor(this.params, "colorHigh")
            .name("Wave Color")
            .onChange((v) => {
                if (this.shaderRef)
                    this.shaderRef.uniforms.uColorHigh.value.set(v);
            });

        // ── Trail wave controls ───────────────────────────────────────────────
        const trailFolder = this.gui.addFolder("Trail");
        const mw = this.mouseTrail;
        const mu = mw.uniforms;

        trailFolder
            .add(mw.params, "fadeTime", 0.2, 6, 0.1)
            .name("Fade Time")
            .onChange((v) => {
                mu.uFadeTime.value = v;
            });

        trailFolder
            .add(mw.params, "trailSpacing", 0.1, 3, 0.05)
            .name("Trail Spacing");

        trailFolder.open();

        // ── Lighting controls ─────────────────────────────────────────────────
        const lightingFolder = this.gui.addFolder("Lighting");
        const lp = this.lightingParams;

        lightingFolder
            .addColor(lp, "ambientColor")
            .name("Ambient Color")
            .onChange((v) => this.ambientLight.color.set(v));

        lightingFolder
            .add(lp, "ambientIntensity", 0.1, 5, 0.01)
            .name("Ambient Intensity")
            .onChange((v) => {
                this.ambientLight.intensity = v;
            });

        lightingFolder
            .addColor(lp, "directionalColor")
            .name("Key Light Color")
            .onChange((v) => this.directionalLight.color.set(v));

        lightingFolder
            .add(lp, "directionalIntensity", 0.1, 10, 0.01)
            .name("Key Light Intensity")
            .onChange((v) => {
                this.directionalLight.intensity = v;
            });

        lightingFolder
            .addColor(lp, "directional2Color")
            .name("Fill Light Color")
            .onChange((v) => this.directionalLight2.color.set(v));

        lightingFolder
            .add(lp, "directional2Intensity", 0.1, 10, 0.01)
            .name("Fill Light Intensity")
            .onChange((v) => {
                this.directionalLight2.intensity = v;
            });

        lightingFolder
            .add(this.shadowCameraHelper, "visible")
            .name("Show Shadow Camera");
    }

    update(delta) {
        this.mouseTrail.update(delta);
        // 移动端限制 GPU 读取的实际活跃轨迹点数量（上限 32），进一步约束着色器单帧采样
        if (
            this.isTouch &&
            this.mouseTrail.uniforms.uTrailCount.value > this.maxTrailCount
        ) {
            this.mouseTrail.uniforms.uTrailCount.value = this.maxTrailCount;
        }
    }
}
