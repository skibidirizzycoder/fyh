// post.ts — the era post filter (ink outlines, resolution, colour grade, grain, vignette, dithering).
// The 3D scene is drawn into a texture (colour + depth) first, then a full-screen quad
// draws that texture through a small shader:
//   both    -> hand-drawn ink outlines, found in the same pass from the depth and colour of
//              each pixel's 4 neighbours (no extra draw calls, no material changes)
//   2004    -> low resolution with chunky pixels, warm tint, low saturation, film grain,
//              strong vignette, then ordered dithering down to a few colour levels
//   present -> full resolution, cool tint, clean, light vignette
// Ink, grain, vignette and dithering are worked out once per scene pixel, so they line up with
// the chunky pixels.

import * as THREE from 'three';
import { CREASE_FULL, creaseOffset, outlineWidth, renderSize, toScenePx, type Look } from './look.ts';

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
  uniform sampler2D tDepth;
  uniform vec2 pixels;
  uniform float chunky;
  uniform vec3 tint;
  uniform float saturation;
  uniform float grain;
  uniform float vignette;
  uniform float levels;
  uniform float frame;
  uniform vec2 depthParams;  // the camera's projection: distance = y / (x + depth in -1..1)
  uniform vec2 viewHalf;     // the camera's half view size at distance 1 (x, y)
  uniform float outline;     // ink width in scene pixels (0 = no outlines)
  uniform vec3 inkColor;
  uniform float inkDepth;
  uniform float inkColorEdge;
  uniform float crease;      // crease test offset in scene pixels (0 = off); creases ink both sides
  uniform vec2 inkCrease;    // cosines of the bend where crease ink starts (y) and is full (x)
  uniform float inkCreaseTone; // tone change across a crease for full ink
  uniform float inkBreakup;
  uniform float inkNoise;    // 1 / size of the breakup noise's patches, in scene pixels
  uniform vec2 fog;          // fog near and far: lines fade out with the objects
  varying vec2 vUv;

  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
  const float GAP_FROM = 0.55; // breakup: noise above this starts fading the lines (about a third of the area)
  const float GAP_TO = 0.8;    // ... and from here on they fade by the full inkBreakup

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

  // Smooth value noise (0..1): the same at a given pixel every frame, so the lines never flicker.
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x);
    float b = mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x);
    return mix(a, b, f.y);
  }

  // 1 / distance of the surface at uv. Along any flat surface it changes evenly across the screen.
  float nearness(vec2 uv) {
    float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
    return (depthParams.x + z) / depthParams.y;
  }

  // The scene's colour at uv as a tone: about perceptual, so edges between dark colours count too.
  vec3 toneAt(vec2 uv) {
    return sqrt(max(texture2D(tScene, uv).rgb, 0.0));
  }

  // Colour-edge strength from one neighbour: how much its tone differs, when it is brighter than
  // this pixel and not behind it. So the line sits on the darker side, and never on a thin prop
  // in front of a background.
  float colourEdge(vec3 tone, vec3 toneN, float w, float wN) {
    bool brighter = dot(toneN - tone, LUMA) >= 0.0;
    bool notBehind = wN >= w * (1.0 - inkDepth);
    return brighter && notBehind ? distance(toneN, tone) : 0.0;
  }

  // Where the surface at uv is in view space (camera at 0, looking down -z), from its nearness w.
  vec3 viewPos(vec2 uv, float w) {
    return vec3((uv * 2.0 - 1.0) * viewHalf, -1.0) / w;
  }

  // Cosine of how sharply the surface bends at b, between its neighbours a and c (1 = flat).
  float bendCos(vec3 a, vec3 b, vec3 c) {
    return dot(normalize(b - a), normalize(c - b));
  }

  // Crease ink (0..1): where the surface bends sharply (box edges, wall meets ground). Not across
  // a silhouette (the depth test inks that, on its far side only), and not between the facets of
  // a round prop (they bend less than the threshold).
  float creaseInk(vec2 uv, float w) {
    vec2 dx = vec2(crease / pixels.x, 0.0);
    vec2 dy = vec2(0.0, crease / pixels.y);
    float wl = nearness(uv - dx);
    float wr = nearness(uv + dx);
    float wd = nearness(uv - dy);
    float wu = nearness(uv + dy);
    float jump = max(abs(wl + wr - 2.0 * w), abs(wd + wu - 2.0 * w)) / w;
    if (jump > inkDepth) return 0.0;
    vec3 p = viewPos(uv, w);
    float bend = min(bendCos(viewPos(uv - dx, wl), p, viewPos(uv + dx, wr)),
                     bendCos(viewPos(uv - dy, wd), p, viewPos(uv + dy, wu)));
    return 1.0 - smoothstep(inkCrease.x, inkCrease.y, bend);
  }

  // How much ink a scene pixel gets (0..1): the far side of a silhouette (depth), sharp creases,
  // the darker side of a colour edge; fading with the fog and broken up in patches by noise.
  float inkAt(vec2 uv, vec3 c, vec2 px) {
    vec2 dx = vec2(outline / pixels.x, 0.0);
    vec2 dy = vec2(0.0, outline / pixels.y);
    float w = nearness(uv);
    float wl = nearness(uv - dx);
    float wr = nearness(uv + dx);
    float wd = nearness(uv - dy);
    float wu = nearness(uv + dy);
    // How much nearer a neighbour is than this pixel's surface continues (0 on any flat surface).
    float jump = max(wl + wr, wd + wu) / w - 2.0;
    float ink = smoothstep(inkDepth, 1.5 * inkDepth, jump);
    vec3 tone = sqrt(max(c, 0.0));
    vec3 tl = toneAt(uv - dx);
    vec3 tr = toneAt(uv + dx);
    vec3 td = toneAt(uv - dy);
    vec3 tu = toneAt(uv + dy);
    if (inkColorEdge > 0.0) {
      float edge = max(max(colourEdge(tone, tl, w, wl), colourEdge(tone, tr, w, wr)),
                       max(colourEdge(tone, td, w, wd), colourEdge(tone, tu, w, wu)));
      ink = max(ink, smoothstep(inkColorEdge, 1.5 * inkColorEdge, edge));
    }
    if (crease > 0.0) {
      // A crease needs a little colour change too, so flat unlit things (the markers) stay clean.
      float spread = max(max(distance(tl, tone), distance(tr, tone)), max(distance(td, tone), distance(tu, tone)));
      ink = max(ink, creaseInk(uv, w) * smoothstep(0.0, inkCreaseTone, spread));
    }
    float nearest = 1.0 / max(max(w, max(wl, wr)), max(wd, wu)); // distance of the nearest surface around
    ink *= 1.0 - smoothstep(fog.x, fog.y, nearest);
    ink *= 1.0 - inkBreakup * smoothstep(GAP_FROM, GAP_TO, valueNoise(px * inkNoise));
    return ink;
  }

  void main() {
    vec2 px = floor(vUv * pixels);                              // which scene pixel this is
    vec2 uv = chunky > 0.5 ? (px + 0.5) / pixels : vUv;         // chunky: its centre, so the whole block matches
    vec3 c = texture2D(tScene, uv).rgb;
    if (outline > 0.0) c = mix(c, inkColor, inkAt(uv, c, px));  // ink outlines, graded with the scene
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
  /** Sets the ink outlines, resolution, colour grade, grain, vignette and dithering (see look.ts). */
  setLook(look: Look): void;
  /** The screen size in device pixels. */
  setSize(width: number, height: number): void;
  /** Debug: turns the ink outlines off or back on (they are on), so tests can measure them. */
  showOutlines(on: boolean): void;
  /** Draws `scene` through the filter onto the screen. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, frame: number): void;
  dispose(): void;
}

/** Makes the shader material that draws the scene's colour and depth textures through the filter. */
function makeMaterial(target: THREE.WebGLRenderTarget): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      tScene: { value: target.texture },
      tDepth: { value: target.depthTexture },
      pixels: { value: new THREE.Vector2(1, 1) },
      chunky: { value: 0 },
      tint: { value: new THREE.Vector3(1, 1, 1) },
      saturation: { value: 1 },
      grain: { value: 0 },
      vignette: { value: 0 },
      levels: { value: 0 },
      frame: { value: 0 },
      depthParams: { value: new THREE.Vector2(-1, -1) },
      viewHalf: { value: new THREE.Vector2(1, 1) },
      outline: { value: 0 },
      inkColor: { value: new THREE.Color() },
      inkDepth: { value: 0 },
      inkColorEdge: { value: 0 },
      crease: { value: 0 },
      inkCrease: { value: new THREE.Vector2(0, 0) },
      inkCreaseTone: { value: 1 },
      inkBreakup: { value: 0 },
      inkNoise: { value: 0 },
      fog: { value: new THREE.Vector2(0, 1) },
    },
    depthTest: false,
    depthWrite: false,
  });
}

/** Resizes the scene textures; scaled-up pixels are sampled nearest (chunky), full size exactly as before. Returns the scale. */
function resizeTarget(target: THREE.WebGLRenderTarget, uniforms: Uniforms, width: number, height: number, pixelHeight: number): number {
  const size = renderSize(width, height, pixelHeight);
  const filter = size.scale > 1 ? THREE.NearestFilter : THREE.LinearFilter;
  if (target.texture.magFilter !== filter) {
    target.texture.minFilter = filter;
    target.texture.magFilter = filter;
    target.dispose(); // the texture is made again with the new filter on the next draw
  }
  target.setSize(size.width, size.height); // the depth texture follows on the next draw
  (uniforms.pixels?.value as THREE.Vector2).set(size.width, size.height);
  if (uniforms.chunky) uniforms.chunky.value = size.scale > 1 ? 1 : 0;
  return size.scale;
}

/** Sets the colour grade, grain, vignette and dithering uniforms. */
function setGrade(u: Uniforms, look: Look): void {
  (u.tint?.value as THREE.Vector3).fromArray(look.tint);
  if (u.saturation) u.saturation.value = look.saturation;
  if (u.grain) u.grain.value = look.grain;
  if (u.vignette) u.vignette.value = look.vignette;
  if (u.levels) u.levels.value = look.colorLevels;
}

/** Sets the ink outline uniforms; widths are turned into whole scene pixels for this screen and scale. */
function setInk(u: Uniforms, look: Look, screenHeight: number, scale: number): void {
  const width = outlineWidth(look.outlinePx, screenHeight, scale);
  if (u.outline) u.outline.value = width;
  if (u.crease) u.crease.value = look.outlineCreaseDeg > 0 ? creaseOffset(width) : 0;
  const deg = THREE.MathUtils.DEG2RAD * look.outlineCreaseDeg;
  (u.inkCrease?.value as THREE.Vector2).set(Math.cos(deg * CREASE_FULL), Math.cos(deg));
  if (u.inkCreaseTone) u.inkCreaseTone.value = look.outlineCreaseTone;
  (u.inkColor?.value as THREE.Color).set(look.outlineColor);
  if (u.inkDepth) u.inkDepth.value = look.outlineDepth;
  if (u.inkColorEdge) u.inkColorEdge.value = look.outlineColorEdge;
  if (u.inkBreakup) u.inkBreakup.value = look.outlineBreakup;
  if (u.inkNoise) u.inkNoise.value = 1 / Math.max(1, toScenePx(look.outlineNoisePx, screenHeight, scale));
  (u.fog?.value as THREE.Vector2).set(look.fogNear, look.fogFar);
}

/** Copies the projection numbers the shader needs to turn depth into distance and view position. */
function setDepthParams(u: Uniforms, camera: THREE.Camera): void {
  const e = camera.projectionMatrix.elements;
  (u.depthParams?.value as THREE.Vector2).set(e[10] ?? -1, e[14] ?? -1);
  (u.viewHalf?.value as THREE.Vector2).set(1 / (e[0] ?? 1), 1 / (e[5] ?? 1));
}

/** Creates the post filter with its render target (colour + depth) and full-screen quad. */
export function createPostFilter(width: number, height: number): PostFilter {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
  const material = makeMaterial(target);
  const u = material.uniforms;
  const screen = { width, height, pixelHeight: 0, scale: 1, look: null as Look | null, ink: true };
  screen.scale = resizeTarget(target, u, width, height, 0);
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeometry, material);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    setLook: (look) => {
      if (look.pixelHeight !== screen.pixelHeight) { // only resize when the look changes
        screen.pixelHeight = look.pixelHeight;
        screen.scale = resizeTarget(target, u, screen.width, screen.height, screen.pixelHeight);
      }
      screen.look = look;
      setGrade(u, look);
      setInk(u, look, screen.height, screen.scale);
      if (!screen.ink && u.outline) u.outline.value = 0;
    },
    setSize: (w, h) => {
      screen.width = w;
      screen.height = h;
      screen.scale = resizeTarget(target, u, w, h, screen.pixelHeight);
      if (screen.look) setInk(u, screen.look, h, screen.scale);
      if (!screen.ink && u.outline) u.outline.value = 0;
    },
    showOutlines: (on) => {
      screen.ink = on;
    },
    render: (renderer, scene, camera, frame) => {
      if (u.frame) u.frame.value = frame % 1000;
      setDepthParams(u, camera);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    },
    dispose: () => {
      target.depthTexture?.dispose();
      target.dispose();
      material.dispose();
      quadGeometry.dispose();
    },
  };
}
