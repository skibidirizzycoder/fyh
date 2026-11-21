// atlas.test.ts — the decoration atlas: which decor gets facades or wood, their UVs and cells, cell brightness.
import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import { ERAS, T } from '../src/tuning.ts';
import { atlasVertices, cellMeans, cellOf, facadeRepeats, facadeSide, isWood } from '../src/world/atlas.ts';
import { PROPS, type Prop } from '../src/world/layout.ts';
import { ATLAS_ATTRIBUTE, celAtlasMaterial } from '../src/world/materials.ts';
import { createShapes } from '../src/world/shapes.ts';

const A = T.cel.atlas;
const DECOR = PROPS.filter((p) => p.decor);

/** A decoration box for the tests. */
function box(id: string, pos: Prop['pos'], size: Prop['size']): Prop {
  return { id, shape: 'box', eras: ['2004', 'present'], pos, size, color: '#888888', decor: true };
}

/** Props merged like build.ts does: each bevelled box at its place, in order; returns the geometry and vertex counts. */
function merged(props: readonly Prop[]): { geometry: THREE.BufferGeometry; counts: number[] } {
  const shapes = createShapes();
  const parts = props.map((p) => shapes.box(p.size).clone().translate(...p.pos));
  const geometry = mergeGeometries(parts);
  if (!geometry) throw new Error('could not merge');
  return { geometry, counts: parts.map((g) => g.getAttribute('position').count) };
}

describe('atlas layout', () => {
  it('every image exists under public/ and fits the grid; the facade and wood cells hold images', () => {
    for (const file of A.files) expect(existsSync(`public/${file}`), file).toBe(true);
    expect(A.files.length).toBeLessThanOrEqual(A.columns * A.rows);
    for (const era of ERAS) {
      expect(A.facades[era].length, era).toBeGreaterThan(0);
      for (const cell of A.facades[era]) expect(A.files[cell], `${era} ${cell}`).toMatch(/facade_/);
    }
    expect(A.files[A.wood]).toMatch(/wood/);
  });

  it('cells run left to right, then up', () => {
    expect(cellOf(0)).toEqual([0, 0]);
    expect(cellOf(A.columns - 1)).toEqual([A.columns - 1, 0]);
    expect(cellOf(A.columns)).toEqual([0, 1]);
  });
});

describe('building fronts', () => {
  it('the big buildings of the street get facades facing the road', () => {
    const sides = new Map(DECOR.map((p) => [p.id, facadeSide(p)]));
    for (const id of ['newsagent', 'pub', 'corner_house', 'start_corner', 'hall', 'far_left', 'far_right']) expect(sides.get(id), id).toBe(1);
    for (const p of DECOR.filter((d) => /^terrace_\d+$/.test(d.id))) expect(sides.get(p.id), p.id).toBe(-1);
    expect(DECOR.filter((p) => facadeSide(p) !== 0).length).toBeGreaterThanOrEqual(15);
  });

  it('skips small and thin boxes, and the walls across the street\'s ends', () => {
    for (const id of ['shop_pilaster_l', 'pub_front', 'hall_door', 'street_end_left', 'street_end_right']) {
      const prop = DECOR.find((p) => p.id === id);
      expect(prop, id).toBeDefined();
      if (prop) expect(facadeSide(prop), id).toBe(0);
    }
    for (const p of DECOR.filter((d) => facadeSide(d) !== 0)) {
      expect(p.size[1], p.id).toBeGreaterThanOrEqual(A.facadeMinHeight);
      expect(p.size[0], p.id).toBeGreaterThanOrEqual(A.facadeMinWidth);
    }
  });

  it('a facade tiles across a wide front so its windows keep their shape', () => {
    expect(facadeRepeats(box('narrow', [0, 3, -4], [4, 6, 3]))).toBe(1);
    expect(facadeRepeats(box('wide', [0, 3, -4], [16, 6, 3]))).toBe(4);
    expect(facadeRepeats(box('thin', [0, 3, -4], [1, 6, 3]))).toBe(1); // never less than once
  });
});

describe('atlas vertices', () => {
  const near = box('near', [0, 3, -4], [8, 6, 3]); // front +Z, two repeats
  const far = box('far', [10, 3, 14], [4, 6, 3]); // front -Z
  const small = box('small', [5, 0.5, 0], [1, 1, 1]);
  const { geometry, counts } = merged([near, far, small]);
  const { uv, cells } = atlasVertices([near, far, small], counts, geometry);
  const normal = geometry.getAttribute('normal');
  const position = geometry.getAttribute('position');
  const ranges = [[0, counts[0] ?? 0], [counts[0] ?? 0, (counts[0] ?? 0) + (counts[1] ?? 0)], [(counts[0] ?? 0) + (counts[1] ?? 0), position.count]] as const;

  /** The vertices of prop i whose normal points along z (more than half) in direction `dir`, bevels included. */
  function face(i: 0 | 1 | 2, dir: 1 | -1): number[] {
    const [from, to] = ranges[i];
    return Array.from({ length: to - from }, (_, k) => from + k).filter((v) => normal.getZ(v) * dir > 0.5);
  }

  it('only the face towards the road shows the facade, in every era', () => {
    for (const era of ERAS) {
      for (const v of face(0, 1)) expect(cells[era][v * 3 + 2]).toBeCloseTo(A.facadeMix);
      for (const v of face(0, -1)) expect(cells[era][v * 3 + 2]).toBe(0);
      for (const v of face(1, -1)) expect(cells[era][v * 3 + 2]).toBeCloseTo(A.facadeMix);
      for (const v of face(1, 1)) expect(cells[era][v * 3 + 2]).toBe(0);
      const [from, to] = ranges[2];
      for (let v = from; v < to; v++) expect(cells[era][v * 3 + 2], 'small box').toBe(0);
    }
  });

  it('neighbouring buildings take turns between the era\'s facades', () => {
    for (const era of ERAS) {
      const [a, b] = A.facades[era];
      const v0 = face(0, 1)[0] ?? -1;
      const v1 = face(1, -1)[0] ?? -1;
      expect([cells[era][v0 * 3], cells[era][v0 * 3 + 1]]).toEqual(cellOf(a ?? 0));
      expect([cells[era][v1 * 3], cells[era][v1 * 3 + 1]]).toEqual(cellOf(b ?? a ?? 0));
    }
  });

  it('lays the facade across the front: left to right as seen from the road, bottom to top', () => {
    const across = (i: 0 | 1, dir: 1 | -1): { x: number; u: number; y: number; v: number }[] =>
      face(i, dir).map((v) => ({ x: position.getX(v), u: uv[v * 2] ?? NaN, y: position.getY(v), v: uv[v * 2 + 1] ?? NaN }));
    const nearFront = across(0, 1);
    expect(Math.min(...nearFront.map((p) => p.u))).toBeCloseTo(0, 2);
    expect(Math.max(...nearFront.map((p) => p.u))).toBeCloseTo(facadeRepeats(near), 2);
    expect(Math.min(...nearFront.map((p) => p.v))).toBeCloseTo(0, 2);
    expect(Math.max(...nearFront.map((p) => p.v))).toBeCloseTo(1, 2);
    const left = nearFront.reduce((a, b) => (b.x < a.x ? b : a)); // the road looks at it towards -Z: left is -x
    expect(left.u).toBeCloseTo(0, 2);
    const farFront = across(1, -1);
    const farLeft = farFront.reduce((a, b) => (b.x > a.x ? b : a)); // facing -Z: left (from the road) is +x
    expect(farLeft.u).toBeCloseTo(0, 2);
  });

  it('wooden decoration shows the wood on every face', () => {
    expect(DECOR.some((p) => isWood(p))).toBe(true);
    const plank = box(A.woodDecor[0] ?? 'bench_back', [0, 0.5, 0], [1.9, 0.36, 0.08]);
    const m = merged([plank]);
    const w = atlasVertices([plank], m.counts, m.geometry);
    for (const era of ERAS) {
      for (let v = 0; v < m.geometry.getAttribute('position').count; v++) {
        expect([w.cells[era][v * 3], w.cells[era][v * 3 + 1]]).toEqual(cellOf(A.wood));
        expect(w.cells[era][v * 3 + 2]).toBeCloseTo(A.woodMix);
      }
    }
  });
});

describe('atlas texture', () => {
  it('measures each cell\'s mean brightness in linear light', () => {
    const atlas = { ...A, columns: 2, rows: 1, cellPx: 4 };
    const width = 8;
    const pixels = new Uint8ClampedArray(width * 4 * 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < width; x++) pixels.set(x < 4 ? [255, 255, 255, 255] : [128, 128, 128, 255], (y * width + x) * 4);
    }
    const [white, grey] = cellMeans(pixels, width, atlas, 1);
    expect(white).toBeCloseTo(1, 4);
    expect(grey).toBeCloseTo(new THREE.Color('#808080').r, 3); // #808080 in linear light
  });

  it('the decoration material reads each vertex\'s atlas cell and tiles inside it without seams', () => {
    const m = celAtlasMaterial();
    expect(m.vertexColors).toBe(true);
    const lib = THREE.ShaderLib.lambert;
    const shader = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: {} as Record<string, THREE.IUniform> };
    m.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    expect(m.defines).toHaveProperty('CEL_ATLAS');
    expect(shader.vertexShader).toContain(`attribute vec3 ${ATLAS_ATTRIBUTE};`);
    expect(shader.fragmentShader).toContain('textureGrad( map, celUv');
    expect(shader.fragmentShader).toContain('vec3 shadeTone = vCelShade * diffuse * celDetail;');
    expect((shader.uniforms.celAtlasMean?.value as number[]).length).toBe(A.columns * A.rows);
  });
});
