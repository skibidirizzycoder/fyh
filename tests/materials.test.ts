// materials.test.ts — cel shading colour maths, the shader patch, and props' textures.
import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAvatar } from '../src/player/avatar.ts';
import { ERAS, T } from '../src/tuning.ts';
import { GROUND, PROPS, propColor, propTexture, type Prop } from '../src/world/layout.ts';
import {
  SHADE_ATTRIBUTE, celMaterial, celVertexMaterial, createMaterials, hexToRgb, hsvToRgb, nudgeHue, rgbToHex, rgbToHsv,
  shadeColor, shadowHsv, shadowTone, surfaceKey, type Surface, type TextureLoad,
} from '../src/world/materials.ts';

const ALL = [GROUND, ...PROPS];

/** Degrees between two hues, the short way round (0..180). */
function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

describe('colour maths', () => {
  it('hex and rgb round-trip', () => {
    for (const hex of ['#000000', '#ffffff', '#7a4a3a', '#2dd4bf', '#ff00ff']) expect(rgbToHex(hexToRgb(hex))).toBe(hex);
  });

  it('rgb and hsv round-trip', () => {
    for (const hex of ['#7a4a3a', '#55595e', '#2dd4bf', '#c8963c', '#ff0000', '#00ff00', '#0000ff', '#808080']) {
      const rgb = hexToRgb(hex);
      hsvToRgb(rgbToHsv(rgb)).forEach((c, i) => expect(c, hex).toBeCloseTo(rgb[i] ?? -1, 9));
    }
    expect(rgbToHsv([1, 0, 0])).toEqual([0, 1, 1]);
    expect(rgbToHsv([0, 0, 1])).toEqual([240, 1, 1]);
  });

  it('nudges a hue the short way round, and never past the target', () => {
    expect(nudgeHue(200, 250, 18)).toBe(218);
    expect(nudgeHue(10, 250, 18)).toBe(352); // 10 -> 250 is shorter going down through 0
    expect(nudgeHue(245, 250, 18)).toBe(250);
    expect(nudgeHue(300, 250, 18)).toBe(282);
  });
});

describe('shadow tone', () => {
  const c = T.cel;

  it('is the colour with its value lowered and its hue nudged towards blue/purple', () => {
    const [h, s, v] = rgbToHsv(hexToRgb('#7a4a3a')); // 2004 brick red
    const [sh, ss, sv] = rgbToHsv(hexToRgb(shadowTone('#7a4a3a')));
    expect(sv).toBeCloseTo(v * c.shadowValue, 2);
    expect(Math.abs(hueGap(sh, h) - c.shadowHueShift)).toBeLessThan(1.5); // the hex is rounded to 8 bits
    expect(hueGap(sh, c.shadowHue)).toBeLessThan(hueGap(h, c.shadowHue));
    expect(ss).toBeGreaterThanOrEqual(s);
  });

  it('gives greys a coloured shade, not a grey one', () => {
    const [sh, ss] = rgbToHsv(hexToRgb(shadowTone('#808080')));
    expect(hueGap(sh, c.shadowHue)).toBeLessThan(6); // 8-bit rounding moves a pale hue a few degrees
    expect(ss).toBeCloseTo(c.shadowMinSaturation, 1);
    const [r, , b] = hexToRgb(shadowTone('#808080'));
    expect(b).toBeGreaterThan(r);
  });

  it('keeps black black', () => {
    expect(shadowTone('#000000')).toBe('#000000');
  });

  it('every prop colour gets a darker shade at least as close to the shade hue', () => {
    for (const p of ALL) {
      for (const era of ERAS) {
        const color = propColor(p, era);
        const [h, , v] = rgbToHsv(hexToRgb(color));
        const [sh, , sv] = shadowHsv(color); // before rounding to 8 bits, which moves dark hues a lot
        expect(sv, `${p.id} ${era}`).toBeLessThanOrEqual(v);
        expect(hueGap(sh, c.shadowHue), `${p.id} ${era}`).toBeLessThanOrEqual(hueGap(h, c.shadowHue) + 1e-9);
      }
    }
  });
});

describe('cel material', () => {
  /** Runs a material's shader patch on three's own Lambert shader. */
  function patched(m: THREE.Material): { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> } {
    const lib = THREE.ShaderLib.lambert;
    const shader = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: {} as Record<string, THREE.IUniform> };
    m.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    return shader;
  }

  it('swaps the Lambert light sum for the two-tone light (three\'s shader still has every hook)', () => {
    const s = patched(celMaterial('#7a4a3a'));
    expect(s.fragmentShader).toContain('vec3 outgoingLight = celLight( diffuseColor.rgb, normal ) + totalEmissiveRadiance;');
    expect(s.fragmentShader).not.toContain('reflectedLight.directDiffuse + reflectedLight.indirectDiffuse');
    expect(s.fragmentShader).toContain('float celCover');
    expect(s.fragmentShader).toContain('vec3 celLight(');
    expect(s.vertexShader).toContain('vCelFront = step( 0.5, objectNormal.z );');
    expect(s.vertexShader).toContain('varying float vCelFront;');
  });

  it('carries its shade tone as a uniform, in linear colour', () => {
    const s = patched(celMaterial('#7a4a3a'));
    const shade = s.uniforms.celShadow?.value as THREE.Color;
    expect(shade.getHexString()).toBe(shadowTone('#7a4a3a').slice(1));
  });

  it('a vertex-coloured cel material reads each vertex\'s shade tone', () => {
    const m = celVertexMaterial();
    expect(m.vertexColors).toBe(true);
    const s = patched(m);
    expect(s.vertexShader).toContain(`attribute vec3 ${SHADE_ATTRIBUTE};`);
    expect(s.fragmentShader).toContain('vec3 shadeTone = vCelShade * diffuse;');
    expect(shadeColor('#7a4a3a').getHexString()).toBe(shadowTone('#7a4a3a').slice(1));
  });

  it('the avatar is cel-shaded, and every vertex-coloured part carries its shade tones', () => {
    const avatar = createAvatar(new THREE.Scene());
    const meshes: THREE.Mesh[] = [];
    avatar.root.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o); });
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      const m = mesh.material as THREE.Material;
      expect(m.customProgramCacheKey(), mesh.name).toBe('cel');
      if (!m.vertexColors) continue;
      const shade = mesh.geometry.getAttribute(SHADE_ATTRIBUTE);
      expect(shade, mesh.name).toBeDefined();
      expect(shade.count, mesh.name).toBe(mesh.geometry.getAttribute('color').count);
    }
    avatar.dispose();
  });

  it('can glow (interactables) or not (decoration)', () => {
    expect(celMaterial('#ffffff', true).emissive.getHexString()).toBe(T.interact.highlightColor.slice(1));
    expect(celMaterial('#ffffff').emissive.getHexString()).toBe('000000');
  });
});

describe('prop textures', () => {
  const brick: Surface = { color: '#7a4a3a', texture: 'textures/brick_2004.png', repeat: [4, 2] };
  const plain: Surface = { color: '#7a4a3a', texture: null, repeat: null };

  /** A fake loader: records requests; the test decides when each one loads or fails. */
  function fakeLoader(): { load: TextureLoad; requests: string[]; finish: (ok: boolean) => void } {
    const pending: (() => void)[] = [];
    const fails: (() => void)[] = [];
    const requests: string[] = [];
    const load: TextureLoad = (url, onLoad, onError) => {
      const t = new THREE.Texture();
      requests.push(url);
      pending.push(() => onLoad(t));
      fails.push(onError);
      return t;
    };
    const finish = (ok: boolean): void => (ok ? pending : fails).splice(0).forEach((f) => f());
    return { load, requests, finish };
  }

  it('reads one path for every era, or one per era', () => {
    const base: Prop = { id: 'x', shape: 'box', eras: ['2004', 'present'], pos: [0, 0, 0], size: [1, 1, 1], color: '#000000' };
    expect(propTexture(base, '2004')).toBeNull();
    expect(propTexture({ ...base, texture: 'textures/a.png' }, 'present')).toBe('textures/a.png');
    expect(propTexture({ ...base, texture: { '2004': 'textures/a.png' } }, '2004')).toBe('textures/a.png');
    expect(propTexture({ ...base, texture: { '2004': 'textures/a.png' } }, 'present')).toBeNull();
  });

  it('every texture a prop names exists under public/ (a missing file would log a 404)', () => {
    for (const p of ALL) {
      for (const era of ERAS) {
        const path = propTexture(p, era);
        if (path) expect(existsSync(`public/${path}`), `${p.id} (${era}): public/${path}`).toBe(true);
        if (path) expect(path.startsWith('/'), `${p.id}: use a relative path`).toBe(false);
      }
      if (p.textureRepeat) expect(p.textureRepeat.every((n) => n > 0), p.id).toBe(true);
    }
  });

  it('the street shows its textures: pavement, 2004 brick, the 2004 window and the poster', () => {
    const tex = (id: string, era: '2004' | 'present'): string | null => propTexture(ALL.find((p) => p.id === id) as Prop, era);
    expect(tex('ground', '2004')).toBe('textures/pavement.png');
    expect(tex('ground', 'present')).toBe('textures/pavement.png');
    expect(tex('shop_wall', '2004')).toBe('textures/brick_2004.png');
    expect(tex('shop_wall', 'present')).toBeNull();
    expect(tex('window_display', '2004')).toBe('textures/window_2004.png');
    expect(tex('noticeboard', '2004')).toBe('textures/poster_open_mic.png');
  });

  it('shares one material per surface, and loads each texture once', () => {
    const f = fakeLoader();
    const lib = createMaterials(f.load);
    expect(lib.shared(brick)).toBe(lib.shared({ ...brick, repeat: [4, 2] }));
    expect(lib.shared(brick)).not.toBe(lib.shared(plain));
    expect(surfaceKey(brick)).not.toBe(surfaceKey({ ...brick, repeat: null }));
    lib.own(brick);
    expect(f.requests).toEqual(['textures/brick_2004.png']);
    expect(lib.counts()).toEqual({ materials: 2, textures: 1 });
  });

  it('shows the texture once it loads, tiled, in sRGB', () => {
    const f = fakeLoader();
    const lib = createMaterials(f.load);
    const m = lib.shared(brick);
    expect(m.map).toBeNull(); // plain colour while loading
    f.finish(true);
    expect(m.map).not.toBeNull();
    expect(m.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(m.map?.wrapS).toBe(THREE.RepeatWrapping);
    expect(m.map?.repeat.toArray()).toEqual([4, 2]);
    expect(lib.shared({ ...brick, color: '#000000' }).map).toBe(m.map); // already loaded: shown at once
  });

  it('a missing file leaves the plain colour and throws nothing', () => {
    const f = fakeLoader();
    const lib = createMaterials(f.load);
    const m = lib.shared(brick);
    expect(() => f.finish(false)).not.toThrow();
    expect(m.map).toBeNull();
    expect(lib.shared({ ...brick, color: '#000000' }).map).toBeNull();
  });

  it('an interactable changes texture with the era', () => {
    const f = fakeLoader();
    const lib = createMaterials(f.load);
    const m = lib.own(brick);
    f.finish(true);
    expect(m.map).not.toBeNull();
    lib.restyle(m, { ...plain, color: '#123456' });
    expect(m.map).toBeNull();
    expect(m.color.getHexString()).toBe(new THREE.Color('#123456').getHexString());
    lib.restyle(m, brick);
    expect(m.map).not.toBeNull();
    expect(() => lib.dispose()).not.toThrow();
  });
});
