// passes.ts — the post filter's extra full-screen passes (used by src/world/post.ts):
//   glow -> the brightest pixels (lit windows, neon, string lights, markers) blurred into a soft
//           glow at a lower resolution: a bright pass with a horizontal blur, then a vertical
//           blur (2 draws). post.ts adds it to the scene per scene pixel, so chunky pixels stay crisp.
//   FXAA -> smooths jagged edges, the ink lines included, after the ink pass (1 draw, full
//           resolution only). It reads display (sRGB) colours, as FXAA expects.

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const glowShader = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 tap;          // uv between two blur taps (along x or along y)
  uniform vec2 rowHalf;      // uv from a tap to its second sample across the blur (first pass)
  uniform float threshold;   // only light brighter than this glows (linear luminance)
  uniform float brightPass;  // 1: keep only the bright part of each tap (first pass); 0: blur as is
  varying vec2 vUv;

  const int TAPS = 4;        // taps on each side of the centre
  const float SIGMA = 2.0;   // width of the Gaussian, in taps
  const float KNEE = 1.5;    // light fades in between threshold and threshold * KNEE

  // The light at uv that glows: all of it, or (bright pass) only what is above the threshold.
  vec3 lightAt(vec2 uv) {
    vec3 c = texture2D(tSrc, uv).rgb;
    if (brightPass < 0.5) return c;
    c = 0.5 * (c + texture2D(tSrc, uv + rowHalf).rgb); // two rows, so thin lights are not missed
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return c * smoothstep(threshold, threshold * KNEE, l);
  }

  void main() {
    vec3 sum = vec3(0.0);
    float total = 0.0;
    for (int i = -TAPS; i <= TAPS; i++) {
      float w = exp(-float(i * i) / (2.0 * SIGMA * SIGMA));
      sum += w * lightAt(vUv + float(i) * tap);
      total += w;
    }
    gl_FragColor = vec4(sum / total, 1.0);
  }
`;

const fxaaShader = /* glsl */ `
  uniform sampler2D tSrc;    // the finished picture, in display (sRGB) colours
  uniform vec2 texel;        // uv size of one pixel
  varying vec2 vUv;

  const float EDGE_MIN = 1.0 / 24.0;  // smaller luma steps than this are left alone (flat areas, grain)
  const float EDGE_REL = 1.0 / 8.0;   // ... and steps smaller than this share of the brightest neighbour
  const float REDUCE_MUL = 1.0 / 8.0; // how much the blur direction is damped in bright areas
  const float REDUCE_MIN = 1.0 / 128.0;
  const float SPAN = 8.0;             // longest blur along an edge, in pixels

  float luma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    vec3 m = texture2D(tSrc, vUv).rgb;
    float lm = luma(m);
    float ltl = luma(texture2D(tSrc, vUv + vec2(-1.0, 1.0) * texel).rgb);  // top left
    float ltr = luma(texture2D(tSrc, vUv + vec2(1.0, 1.0) * texel).rgb);   // top right
    float lbl = luma(texture2D(tSrc, vUv + vec2(-1.0, -1.0) * texel).rgb); // bottom left
    float lbr = luma(texture2D(tSrc, vUv + vec2(1.0, -1.0) * texel).rgb);  // bottom right
    float lo = min(lm, min(min(ltl, ltr), min(lbl, lbr)));
    float hi = max(lm, max(max(ltl, ltr), max(lbl, lbr)));
    if (hi - lo < max(EDGE_MIN, hi * EDGE_REL)) {   // no edge here: keep the pixel
      gl_FragColor = vec4(m, 1.0);
      return;
    }
    // The edge runs across the brightness gradient: blur along it.
    float gx = (ltr + lbr) - (ltl + lbl);
    float gy = (ltl + ltr) - (lbl + lbr);
    vec2 dir = vec2(-gy, gx);
    float reduce = max((ltl + ltr + lbl + lbr) * 0.25 * REDUCE_MUL, REDUCE_MIN);
    dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -SPAN, SPAN) * texel;
    vec3 near = 0.5 * (texture2D(tSrc, vUv - dir / 6.0).rgb + texture2D(tSrc, vUv + dir / 6.0).rgb);
    vec3 far = 0.5 * near + 0.25 * (texture2D(tSrc, vUv - dir * 0.5).rgb + texture2D(tSrc, vUv + dir * 0.5).rgb);
    float lf = luma(far);
    gl_FragColor = vec4(lf < lo || lf > hi ? near : far, 1.0); // the long blur overshot: use the short one
  }
`;

/** One full-screen quad that draws any of the passes' materials into a target (or the screen). */
export interface Quad {
  draw(renderer: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget | null): void;
  dispose(): void;
}

/** Makes the full-screen quad. */
export function createQuad(): Quad {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    draw: (renderer, material, target) => {
      mesh.material = material;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
    },
    dispose: () => geometry.dispose(),
  };
}

/** Settings of the glow, from the look (see look.ts). */
export interface GlowSettings {
  threshold: number;
  scale: number; // the glow's resolution, as a share of the scene's
  spread: number; // glow texels between two blur taps
}

/** The soft glow: its two half-blurred textures and the two blur passes. */
export interface Glow {
  /** The glow texture post.ts adds to the scene. */
  texture: THREE.Texture;
  /** Blurs the bright parts of `scene` (a texture `width` x `height`) into `texture`: 2 draws. */
  render(renderer: THREE.WebGLRenderer, quad: Quad, scene: THREE.Texture, width: number, height: number, settings: GlowSettings): void;
  dispose(): void;
}

/** A material for one of the passes. */
function passMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false });
}

/** Makes the glow's targets and blur material. */
export function createGlow(): Glow {
  const options = { type: THREE.HalfFloatType, depthBuffer: false };
  const across = new THREE.WebGLRenderTarget(1, 1, options); // bright pass, blurred along x
  const done = new THREE.WebGLRenderTarget(1, 1, options); // then blurred along y
  const material = passMaterial(glowShader, {
    tSrc: { value: null },
    tap: { value: new THREE.Vector2() },
    rowHalf: { value: new THREE.Vector2() },
    threshold: { value: 1 },
    brightPass: { value: 1 },
  });
  const u = material.uniforms;
  return {
    texture: done.texture,
    render: (renderer, quad, scene, width, height, s) => {
      const w = Math.max(1, Math.round(width * s.scale));
      const h = Math.max(1, Math.round(height * s.scale));
      across.setSize(w, h);
      done.setSize(w, h);
      if (u.threshold) u.threshold.value = s.threshold;
      if (u.tSrc) u.tSrc.value = scene;
      if (u.brightPass) u.brightPass.value = 1;
      (u.tap?.value as THREE.Vector2).set(s.spread / w, 0);
      (u.rowHalf?.value as THREE.Vector2).set(0, 0.5 / h);
      quad.draw(renderer, material, across);
      if (u.tSrc) u.tSrc.value = across.texture;
      if (u.brightPass) u.brightPass.value = 0;
      (u.tap?.value as THREE.Vector2).set(0, s.spread / h);
      quad.draw(renderer, material, done);
    },
    dispose: () => {
      across.dispose();
      done.dispose();
      material.dispose();
    },
  };
}

/** FXAA: the picture is drawn into `target` first, then `render` smooths it onto the screen (1 draw). */
export interface Fxaa {
  target: THREE.WebGLRenderTarget;
  setSize(width: number, height: number): void;
  render(renderer: THREE.WebGLRenderer, quad: Quad): void;
  dispose(): void;
}

/** Makes the FXAA pass and its 8-bit target (display colours, like the screen). */
export function createFxaa(): Fxaa {
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const material = passMaterial(fxaaShader, { tSrc: { value: target.texture }, texel: { value: new THREE.Vector2(1, 1) } });
  return {
    target,
    setSize: (width, height) => {
      const w = Math.max(1, Math.floor(width));
      const h = Math.max(1, Math.floor(height));
      target.setSize(w, h);
      (material.uniforms.texel?.value as THREE.Vector2).set(1 / w, 1 / h);
    },
    render: (renderer, quad) => quad.draw(renderer, material, null),
    dispose: () => {
      target.dispose();
      material.dispose();
    },
  };
}
