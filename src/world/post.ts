// post.ts — the era post filter (resolution, colour grade, grain, vignette, dithering).
// The 3D scene is drawn into a texture first, then a full-screen quad
// draws that texture through a small shader:
//   2004    -> low resolution with chunky pixels, warm tint, low saturation, film grain,
//              strong vignette, then ordered dithering down to a few colour levels
//   present -> full resolution, cool tint, clean, light vignette
// Grain, vignette and dithering are worked out once per scene pixel, so they line up with
// the chunky pixels.

import * as THREE from 'three';
import { renderSize, type Look } from './look.ts';

type Uniforms = THREE.ShaderMaterial['uniforms'];

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 pixels;
  uniform float chunky;
  uniform vec3 tint;
  uniform float saturation;
  uniform float grain;
  uniform float vignette;
  uniform float levels;
  uniform float frame;
  varying vec2 vUv;

  // Cheap pseudo-random number from a 2D position.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // 2x2 Bayer index (0..3) of a cell: 0 2 / 3 1.
  float bayer2(vec2 a) {
    return 2.0 * abs(a.x - a.y) + a.y;
  }

  // 4x4 Bayer threshold (0..1) of a scene pixel: the classic ordered-dither pattern.
  float bayer4(vec2 p) {
    vec2 q = mod(p, 4.0);
    vec2 fine = mod(q, 2.0);
    vec2 coarse = floor(q / 2.0);
    return (4.0 * bayer2(fine) + bayer2(coarse) + 0.5) / 16.0;
  }

  // Rounds each channel to one of n levels, nudged by the dither threshold t.
  vec3 quantise(vec3 c, float n, float t) {
    return floor(clamp(c, 0.0, 1.0) * (n - 1.0) + t) / (n - 1.0);
  }

  void main() {
    vec2 px = floor(vUv * pixels);                              // which scene pixel this is
    vec2 uv = chunky > 0.5 ? (px + 0.5) / pixels : vUv;         // chunky: its centre, so the whole block matches
    vec3 c = texture2D(tScene, uv).rgb;
    float grey = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(grey), c, saturation) * tint;                 // colour grade
    float d = distance(uv, vec2(0.5));
    c *= 1.0 - vignette * smoothstep(0.35, 0.85, d);           // vignette
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    // From here on the colour is in display (sRGB) values, so grain and colour levels are even from dark to light.
    gl_FragColor.rgb += (hash(uv * 1000.0 + frame) - 0.5) * grain;                       // film grain
    if (levels > 1.0) gl_FragColor.rgb = quantise(gl_FragColor.rgb, levels, bayer4(px)); // ordered dither
  }
`;

export interface PostFilter {
  /** Sets the resolution, colour grade, grain, vignette and dithering (see look.ts). */
  setLook(look: Look): void;
  /** The screen size in device pixels. */
  setSize(width: number, height: number): void;
  /** Draws `scene` through the filter onto the screen. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, frame: number): void;
  dispose(): void;
}

/** Makes the shader material that draws the scene texture through the filter. */
function makeMaterial(scene: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      tScene: { value: scene },
      pixels: { value: new THREE.Vector2(1, 1) },
      chunky: { value: 0 },
      tint: { value: new THREE.Vector3(1, 1, 1) },
      saturation: { value: 1 },
      grain: { value: 0 },
      vignette: { value: 0 },
      levels: { value: 0 },
      frame: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
}

/** Resizes the scene texture; scaled-up pixels are sampled nearest (chunky), full size exactly as before. */
function resizeTarget(target: THREE.WebGLRenderTarget, uniforms: Uniforms, width: number, height: number, pixelHeight: number): void {
  const size = renderSize(width, height, pixelHeight);
  const filter = size.scale > 1 ? THREE.NearestFilter : THREE.LinearFilter;
  if (target.texture.magFilter !== filter) {
    target.texture.minFilter = filter;
    target.texture.magFilter = filter;
    target.dispose(); // the texture is made again with the new filter on the next draw
  }
  target.setSize(size.width, size.height);
  (uniforms.pixels?.value as THREE.Vector2).set(size.width, size.height);
  if (uniforms.chunky) uniforms.chunky.value = size.scale > 1 ? 1 : 0;
}

/** Creates the post filter with its render target and full-screen quad. */
export function createPostFilter(width: number, height: number): PostFilter {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const material = makeMaterial(target.texture);
  const screen = { width, height, pixelHeight: 0 };
  resizeTarget(target, material.uniforms, width, height, 0);
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeometry, material);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    setLook: (look) => {
      const u = material.uniforms;
      (u.tint?.value as THREE.Vector3).fromArray(look.tint);
      if (u.saturation) u.saturation.value = look.saturation;
      if (u.grain) u.grain.value = look.grain;
      if (u.vignette) u.vignette.value = look.vignette;
      if (u.levels) u.levels.value = look.colorLevels;
      if (look.pixelHeight === screen.pixelHeight) return; // only resize when the look changes
      screen.pixelHeight = look.pixelHeight;
      resizeTarget(target, material.uniforms, screen.width, screen.height, screen.pixelHeight);
    },
    setSize: (w, h) => {
      screen.width = w;
      screen.height = h;
      resizeTarget(target, material.uniforms, w, h, screen.pixelHeight);
    },
    render: (renderer, scene, camera, frame) => {
      if (material.uniforms.frame) material.uniforms.frame.value = frame % 1000;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    },
    dispose: () => {
      target.dispose();
      material.dispose();
      quadGeometry.dispose();
    },
  };
}
