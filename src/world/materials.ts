// materials.ts — the cel-shaded materials every prop is drawn with, and the textures props can show.
//
// Cel shading: a surface is either lit (its own colour) or in shade, with a soft step between
// (N·L of the sun against T.cel.litEdge). The shade is NOT grey: it is the colour in HSV with its
// value lowered and its hue nudged towards blue/purple (shadowTone). The scene light (sun colour
// and sky) then tints both tones, so each era and moment keeps its own light.
//
// Textures: a prop may show an image (Prop.texture). Without textureRepeat it covers the front
// face (+Z) once; with textureRepeat it tiles on every face. A textured face mixes the image with
// the prop's era colour (T.cel.textureMixFront / textureMixTiled). A texture that fails to load
// leaves the plain colour.
//
// Materials are shared per surface (colour + texture), so props of the same colour reuse one.
// Merged meshes coloured per vertex (street decor, the avatar) use celVertexMaterial(): their
// geometry carries each vertex's shade tone too, in the SHADE_ATTRIBUTE attribute (shadeColor()).

import * as THREE from 'three';
import { T } from '../tuning.ts';

type Rgb = readonly [number, number, number];

/** Name of the per-vertex shade tone attribute that celVertexMaterial() reads. */
export const SHADE_ATTRIBUTE = 'celShade';

/** What a prop's surface looks like in one era. */
export interface Surface {
  color: string;
  texture: string | null; // path under public/, e.g. 'textures/pavement.png'
  repeat: readonly [number, number] | null; // null: front face only, shown once
}

/** Loads an image as a texture; calls onLoad or onError (never both). Swapped out in unit tests. */
export type TextureLoad = (url: string, onLoad: (t: THREE.Texture) => void, onError: () => void) => THREE.Texture;

export interface Materials {
  /** The shared material for a surface (made the first time it is asked for). */
  shared(surface: Surface): THREE.MeshLambertMaterial;
  /** A material of its own, with the highlight glow colour (interactables). */
  own(surface: Surface): THREE.MeshLambertMaterial;
  /** Gives a material made by own() another surface (an era change). */
  restyle(material: THREE.MeshLambertMaterial, surface: Surface): void;
  /** How many shared materials and textures exist (for tests). */
  counts(): { materials: number; textures: number };
  dispose(): void;
}

// ---------- colour maths (pure) ----------

/** '#rrggbb' to [r, g, b] in 0..1. */
export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** [r, g, b] in 0..1 to '#rrggbb'. */
export function rgbToHex(rgb: Rgb): string {
  const byte = (c: number): string => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0');
  return `#${rgb.map(byte).join('')}`;
}

/** [r, g, b] in 0..1 to [hue in degrees 0..360, saturation 0..1, value 0..1]. */
export function rgbToHsv([r, g, b]: Rgb): Rgb {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0 && max === r) h = ((g - b) / d) % 6;
  else if (d > 0 && max === g) h = (b - r) / d + 2;
  else if (d > 0) h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, max > 0 ? d / max : 0, max];
}

/** [hue in degrees, saturation, value] to [r, g, b] in 0..1. */
export function hsvToRgb([h, s, v]: Rgb): Rgb {
  const f = (n: number): number => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

/** Moves hue `from` towards `to` (degrees) the short way round, by at most `maxDeg`. */
export function nudgeHue(from: number, to: number, maxDeg: number): number {
  const diff = ((to - from + 540) % 360) - 180; // -180..180: the shortest turn
  const turn = Math.max(-maxDeg, Math.min(maxDeg, diff));
  return (from + turn + 360) % 360;
}

/**
 * The shade tone of a colour, in HSV: value lowered, hue nudged towards T.cel.shadowHue, saturation
 * raised a little (and at least T.cel.shadowMinSaturation, so even greys get a coloured shade).
 */
export function shadowHsv(hex: string, cel = T.cel): Rgb {
  const [h, s, v] = rgbToHsv(hexToRgb(hex));
  const grey = s < cel.shadowMinSaturation; // a grey has no hue worth keeping: take the shade hue
  const hue = grey ? cel.shadowHue : nudgeHue(h, cel.shadowHue, cel.shadowHueShift);
  const sat = Math.min(1, Math.max(s * cel.shadowSaturation, cel.shadowMinSaturation));
  return [hue, sat, v * cel.shadowValue];
}

/** The shade tone of a colour, as '#rrggbb'. */
export function shadowTone(hex: string, cel = T.cel): string {
  return rgbToHex(hsvToRgb(shadowHsv(hex, cel)));
}

/** The key of a surface's texture and tiling ('' without a texture). */
export function textureKey(s: Surface): string {
  return s.texture ? `${s.texture}|${s.repeat ? s.repeat.join('x') : 'front'}` : '';
}

/** The key two surfaces share when they can use one material. */
export function surfaceKey(s: Surface): string {
  return `${s.color}|${textureKey(s)}`;
}

// ---------- the shader ----------

/** A number as a GLSL float literal. */
function glsl(n: number): string {
  return n.toFixed(5);
}

/** How much a texture's detail keeps in the shade: the shade value, in linear light. */
function shadeDetail(): number {
  const v = T.cel.shadowValue;
  return new THREE.Color().setRGB(v, v, v, THREE.SRGBColorSpace).r;
}

/** Constants and the lighting function added to the Lambert fragment shader. */
function fragmentHeader(): string {
  const c = T.cel;
  return /* glsl */ `
uniform vec3 celShadow;    // this material's shade tone (linear)
uniform float celMapAll;   // 1: the texture covers every face; 0: only the front (+Z) face
varying float vCelFront;   // 1 on the front (+Z) face of the unit box
#ifdef CEL_VERTEX_SHADE
varying vec3 vCelShade;    // vertex-coloured meshes: this vertex's shade tone (linear)
#endif
#define CEL_EDGE ${glsl(c.litEdge)}
#define CEL_SOFT ${glsl(c.litSoftness)}
#define CEL_GRADIENT ${glsl(c.litGradient)}
#define CEL_SUN ${glsl(c.sunWeight)}
#define CEL_SKY ${glsl(c.skyWeight)}
#define CEL_MIX_FRONT ${glsl(c.textureMixFront)}
#define CEL_MIX_TILED ${glsl(c.textureMixTiled)}
#define CEL_SHADE_DETAIL ${glsl(shadeDetail())}

// Two-tone light: the lit tone where the sun reaches (N·L past the edge), else the shade tone;
// both are tinted by the scene's light (sun colour x intensity, plus the sky).
vec3 celLight( vec3 base, vec3 n ) {
  vec3 sun = vec3( 0.0 );
  vec3 sky = vec3( 0.0 );
  float nl = 0.0;
  #if NUM_DIR_LIGHTS > 0
    sun = directionalLights[ 0 ].color;
    nl = dot( n, directionalLights[ 0 ].direction );
  #endif
  #if NUM_HEMI_LIGHTS > 0
    sky = hemisphereLights[ 0 ].skyColor;
  #endif
  float lit = smoothstep( CEL_EDGE - CEL_SOFT, CEL_EDGE + CEL_SOFT, nl );
  vec3 litTone = base * ( 1.0 - CEL_GRADIENT * ( 1.0 - saturate( nl ) ) );
  #ifdef CEL_VERTEX_SHADE
    vec3 shadeTone = vCelShade * diffuse;
  #else
    vec3 shadeTone = max( celShadow + ( base - diffuse ) * CEL_SHADE_DETAIL, 0.0 ); // texture detail on the shade
  #endif
  return mix( shadeTone, litTone, lit ) * ( sun * CEL_SUN + sky * CEL_SKY );
}
`;
}

/** Texture: mixed into the base colour on the faces it covers. */
const MAP_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
  vec4 celTexel = texture2D( map, vMapUv );
  float celCover = celMapAll > 0.5 ? CEL_MIX_TILED : vCelFront * CEL_MIX_FRONT;
  diffuseColor.rgb = mix( diffuseColor.rgb, celTexel.rgb, celCover );
#endif
`;

/** Vertex shader additions: the front-face flag, and each vertex's shade tone when it has one. */
const VERTEX_HEADER = `varying float vCelFront;
#ifdef CEL_VERTEX_SHADE
attribute vec3 ${SHADE_ATTRIBUTE};
varying vec3 vCelShade;
#endif`;
const VERTEX_MAIN = `vCelFront = step( 0.5, objectNormal.z );
#ifdef CEL_VERTEX_SHADE
vCelShade = ${SHADE_ATTRIBUTE};
#endif`;

const LAMBERT_OUT = 'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;';

/** Swaps the Lambert light sum for the two-tone cel light (the emissive glow stays on top). */
function patchShader(shader: THREE.WebGLProgramParametersWithUniforms, uniforms: CelUniforms): void {
  shader.uniforms.celShadow = uniforms.celShadow;
  shader.uniforms.celMapAll = uniforms.celMapAll;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERTEX_HEADER}`)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${VERTEX_MAIN}`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <lights_lambert_pars_fragment>', `#include <lights_lambert_pars_fragment>\n${fragmentHeader()}`)
    .replace('#include <map_fragment>', MAP_FRAGMENT)
    .replace(LAMBERT_OUT, 'vec3 outgoingLight = celLight( diffuseColor.rgb, normal ) + totalEmissiveRadiance;');
}

interface CelUniforms {
  celShadow: { value: THREE.Color };
  celMapAll: { value: number };
}

/** Sets a cel material's colour and shade tone. */
function setColor(m: THREE.MeshLambertMaterial, color: string): void {
  m.color.set(color);
  (m.userData.cel as CelUniforms).celShadow.value.set(shadowTone(color));
}

/** A new cel material (Lambert with the cel light patched in), without a texture yet. */
export function celMaterial(color: string, glow = false): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ emissive: glow ? T.interact.highlightColor : '#000000', emissiveIntensity: 0 });
  const uniforms: CelUniforms = { celShadow: { value: new THREE.Color() }, celMapAll: { value: 0 } };
  m.userData.cel = uniforms;
  m.onBeforeCompile = (shader) => patchShader(shader, uniforms);
  m.customProgramCacheKey = () => 'cel'; // every cel material shares the same shader code
  setColor(m, color);
  return m;
}

/** The shade tone of a colour, as a linear colour (for the SHADE_ATTRIBUTE of a vertex-coloured mesh). */
export function shadeColor(hex: string): THREE.Color {
  return new THREE.Color(shadowTone(hex));
}

/** A cel material coloured per vertex: the geometry needs `color` and SHADE_ATTRIBUTE attributes. */
export function celVertexMaterial(): THREE.MeshLambertMaterial {
  const m = celMaterial('#ffffff');
  m.vertexColors = true;
  m.defines = { CEL_VERTEX_SHADE: '' };
  return m;
}

// ---------- textures ----------

let bitmapLoader: THREE.ImageBitmapLoader | null = null; // made on first use (unit tests have no createImageBitmap)

/**
 * The default loader: fetch + createImageBitmap (three's ImageBitmapLoader), relative URLs so any base
 * path works. Unlike an <img>, a fetch does not hold up the page's load event, and the image is decoded
 * off the main thread (with an <img>, the shipped page took 23-30 s to "load" on a software GPU).
 */
const loadAsBitmap: TextureLoad = (url, onLoad, onError) => {
  bitmapLoader ??= new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY' });
  const texture = new THREE.Texture();
  texture.flipY = false; // already flipped while decoding (WebGL ignores flipY for bitmaps)
  bitmapLoader.load(url, (bitmap) => {
    texture.image = bitmap;
    texture.needsUpdate = true;
    onLoad(texture);
  }, undefined, () => onError());
  return texture;
};

/** Frees a texture and, for a decoded bitmap, its image memory. */
function freeTexture(t: THREE.Texture): void {
  (t.image as { close?: () => void } | null)?.close?.();
  t.dispose();
}

/** Sets colour space, filtering and tiling of a texture from tuning. */
function setupTexture(t: THREE.Texture, repeat: Surface['repeat']): void {
  t.colorSpace = THREE.SRGBColorSpace;
  const nearest = T.cel.textureFilter === 'nearest';
  t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.minFilter = nearest ? THREE.NearestMipmapNearestFilter : THREE.LinearMipmapLinearFilter;
  if (!repeat) return;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
}

/** One texture per path and tiling. Materials wait for it; a missing file leaves them plain. */
interface TextureEntry {
  texture: THREE.Texture;
  state: 'loading' | 'ready' | 'missing';
  waiting: THREE.MeshLambertMaterial[];
}

/** Creates the material and texture library for the world. */
export function createMaterials(load: TextureLoad = loadAsBitmap): Materials {
  const materials = new Map<string, THREE.MeshLambertMaterial>();
  const owned = new Set<THREE.MeshLambertMaterial>();
  const textures = new Map<string, TextureEntry>();

  /** Shows a loaded texture on a material (the shader is rebuilt with the map). */
  function showMap(m: THREE.MeshLambertMaterial, t: THREE.Texture): void {
    m.map = t;
    m.needsUpdate = true;
  }

  /** Starts loading a surface's texture once per path and tiling; returns its entry. */
  function textureFor(s: Surface & { texture: string }): TextureEntry {
    const key = textureKey(s);
    const known = textures.get(key);
    if (known) return known;
    const entry: TextureEntry = { texture: new THREE.Texture(), state: 'loading', waiting: [] };
    textures.set(key, entry);
    const onLoad = (t: THREE.Texture): void => {
      entry.state = 'ready';
      entry.waiting.forEach((m) => { if (m.userData.texture === key) showMap(m, t); });
      entry.waiting = [];
    };
    const onError = (): void => { // a missing file: the props keep their plain colour, nothing is thrown
      entry.state = 'missing';
      entry.waiting = [];
    };
    entry.texture = load(s.texture, onLoad, onError);
    setupTexture(entry.texture, s.repeat);
    return entry;
  }

  /** Gives a material a surface's colour and (once loaded) texture. */
  function style(m: THREE.MeshLambertMaterial, s: Surface): void {
    setColor(m, s.color);
    (m.userData.cel as CelUniforms).celMapAll.value = s.repeat ? 1 : 0;
    const key = textureKey(s);
    if (m.userData.texture === key) return;
    m.userData.texture = key;
    if (m.map) {
      m.map = null;
      m.needsUpdate = true;
    }
    if (!s.texture) return;
    const entry = textureFor({ ...s, texture: s.texture });
    if (entry.state === 'ready') showMap(m, entry.texture);
    else if (entry.state === 'loading') entry.waiting.push(m);
  }

  return {
    shared(surface) {
      const key = surfaceKey(surface);
      let m = materials.get(key);
      if (!m) {
        m = celMaterial(surface.color);
        style(m, surface);
        materials.set(key, m);
      }
      return m;
    },
    own(surface) {
      const m = celMaterial(surface.color, true);
      style(m, surface);
      owned.add(m);
      return m;
    },
    restyle: style,
    counts: () => ({ materials: materials.size, textures: textures.size }),
    dispose() {
      materials.forEach((m) => m.dispose());
      owned.forEach((m) => m.dispose());
      textures.forEach((e) => freeTexture(e.texture));
      materials.clear();
      owned.clear();
      textures.clear();
    },
  };
}
