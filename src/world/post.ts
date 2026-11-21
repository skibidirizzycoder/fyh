// post.ts — the era post filter (colour grade, grain, vignette).
// The 3D scene is drawn into a texture first, then a full-screen quad
// draws that texture through a small shader:
//   2004    -> warm tint, low saturation, film grain, strong vignette
//   present -> cool tint, clean, light vignette

import * as THREE from 'three';
import { T, type Era } from '../tuning.ts';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec3 tint;
  uniform float saturation;
  uniform float grain;
  uniform float vignette;
  uniform float frame;
  varying vec2 vUv;

  // Cheap pseudo-random number from a 2D position.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 c = texture2D(tScene, vUv).rgb;
    float grey = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(grey), c, saturation) * tint;                 // colour grade
    c += (hash(vUv * 1000.0 + frame) - 0.5) * grain;           // film grain
    float d = distance(vUv, vec2(0.5));
    c *= 1.0 - vignette * smoothstep(0.35, 0.85, d);           // vignette
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface PostFilter {
  setEra(era: Era): void;
  setSize(width: number, height: number): void;
  /** Draws `scene` through the filter onto the screen. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, frame: number): void;
  dispose(): void;
}

/** Creates the post filter with its render target and full-screen quad. */
export function createPostFilter(width: number, height: number): PostFilter {
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType });
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      tScene: { value: target.texture },
      tint: { value: new THREE.Vector3(1, 1, 1) },
      saturation: { value: 1 },
      grain: { value: 0 },
      vignette: { value: 0 },
      frame: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeometry, material);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    setEra: (era) => {
      const look = T.eras[era];
      const u = material.uniforms;
      (u.tint?.value as THREE.Vector3).fromArray(look.tint);
      if (u.saturation) u.saturation.value = look.saturation;
      if (u.grain) u.grain.value = look.grain;
      if (u.vignette) u.vignette.value = look.vignette;
    },
    setSize: (w, h) => target.setSize(w, h),
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
