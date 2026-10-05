import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const VignetteRGBShiftShader = {
    uniforms: {
        tDiffuse: { value: null },
        shiftAmount: { value: 0.005 }, // Maximum color split intensity
        vignetteRadius: { value: 0.3 }, // Where the effect starts (0.0 to 1.0)
        vignetteSoftness: { value: 0.3 }, // Falloff smoothness of the effect
    },

    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

    fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float shiftAmount;
    uniform float vignetteRadius;
    uniform float vignetteSoftness;
    varying vec2 vUv;

    void main() {
      // 1. Calculate distance from the center of the screen (0.5, 0.5)
      vec2 center = vec2(0.5);
      float dist = distance(vUv, center);
      float horzQuadrant = sign(vUv.x - center.x); // -1 on left, +1 on right
      float vertQuadrant = sign(vUv.y - center.y); // -1 on bottom, +1 on top

      // 2. Create the vignette mask (0.0 at center, closer to 1.0 at corners)
      float vignetteFactor = smoothstep(vignetteRadius, vignetteRadius + vignetteSoftness, dist);

      // 3. Scale the shift intensity based on the vignette mask
      float currentShift = shiftAmount * vignetteFactor;

      // 4. Sample the color channels with the dynamic shift
      // Shifts Red up/right and Blue down/left based on the vignette intensity
      float r = texture2D(tDiffuse, vUv + vec2(currentShift * horzQuadrant, currentShift * vertQuadrant)).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - vec2(currentShift * horzQuadrant, currentShift * vertQuadrant)).b;

      // 5. Apply a standard darkening vignette overlay (Optional)
      // Darkens the corners to match the chromatic aberration
      float darken = 1.0 - vignetteFactor * 0.5; // Adjust 0.5 to change darkness

      gl_FragColor = vec4(vec3(r, g, b) * darken, 1.0);
    }
  `,
};

export { VignetteRGBShiftShader };
