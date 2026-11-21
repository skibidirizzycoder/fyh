// atlas.ts — one texture for the merged street decoration: the facade images and the wood, side by side.
// The decoration is drawn as a few merged meshes (build.ts), so it cannot have a material per building.
// Instead each vertex says which atlas cell it shows (per era) and how much, and building fronts get
// UVs that lay the facade across them; the cel shader (materials.ts, CEL_ATLAS) uses the image's
// brightness as a pattern on the vertex colour, so every building keeps its own tint.

import * as THREE from 'three';
import { ERAS, T, type Era } from '../tuning.ts';
import type { Prop } from './layout.ts';

/** The atlas settings (T.cel.atlas); tests pass smaller ones. */
type Atlas = Omit<typeof T.cel.atlas, 'columns' | 'rows' | 'cellPx' | 'files'> & {
  files: readonly string[];
  columns: number;
  rows: number;
  cellPx: number;
};

/** The column and row of an atlas cell (cells run left to right, then up). */
export function cellOf(index: number, atlas: Atlas = T.cel.atlas): [number, number] {
  return [index % atlas.columns, Math.floor(index / atlas.columns)];
}

/**
 * Which way a decoration prop's building front faces: +1 (+Z), -1 (-Z), or 0 when it is not a building.
 * A building is a box at least facadeMinHeight tall and facadeMinWidth wide on one side of the road;
 * its front is the face towards the road (walls that run across the road, at the street's ends, have none).
 */
export function facadeSide(prop: Prop, atlas: Atlas = T.cel.atlas): 1 | -1 | 0 {
  if (prop.shape !== 'box' || prop.label) return 0;
  const [width, height, depth] = prop.size;
  if (height < atlas.facadeMinHeight || width < atlas.facadeMinWidth) return 0;
  const z = prop.pos[2];
  if (Math.abs(z - atlas.streetZ) < depth / 2) return 0;
  return z < atlas.streetZ ? 1 : -1;
}

/** How many times a facade image repeats across a building front, so its windows keep their shape. */
export function facadeRepeats(prop: Prop, atlas: Atlas = T.cel.atlas): number {
  return Math.max(1, Math.round(prop.size[0] / (prop.size[1] * atlas.facadeAspect)));
}

/** True for decoration made of wood (the grain shows on every face). */
export function isWood(prop: Prop, atlas: Atlas = T.cel.atlas): boolean {
  return atlas.woodDecor.includes(prop.id);
}

/** Per-vertex atlas data of one merged decoration group. */
export interface AtlasVertices {
  uv: Float32Array; // 2 per vertex: where in its cell (whole numbers tile the image again)
  cells: Record<Era, Float32Array>; // 3 per vertex: cell column, row, and how much shows (0: none)
}

/** What one prop shows: its cell in each era and how much, or null for nothing. */
interface PropImage {
  cell: Record<Era, number>;
  mix: number;
  side: 1 | -1 | 0; // a facade's front (only those vertices show it); 0: every face (wood)
}

/** The image a prop shows; `building` counts the buildings before it, so neighbours take turns. */
function propImage(prop: Prop, building: number, atlas: Atlas): PropImage | null {
  const side = facadeSide(prop, atlas);
  if (side !== 0) {
    const cell = {} as Record<Era, number>;
    for (const era of ERAS) {
      const choices = atlas.facades[era];
      cell[era] = choices[building % choices.length] ?? 0;
    }
    return { cell, mix: atlas.facadeMix, side };
  }
  if (!isWood(prop, atlas)) return null;
  const cell = Object.fromEntries(ERAS.map((era) => [era, atlas.wood])) as Record<Era, number>;
  return { cell, mix: atlas.woodMix, side: 0 };
}

/** UV of a building-front vertex: across the front (left to right as seen from the road), and up it. */
function facadeUv(prop: Prop, side: 1 | -1, x: number, y: number, atlas: Atlas): [number, number] {
  const [width, height] = prop.size;
  const left = prop.pos[0] - (side * width) / 2; // the left edge as seen from the road
  const across = (side * (x - left)) / width;
  return [across * facadeRepeats(prop, atlas), (y - (prop.pos[1] - height / 2)) / height];
}

/**
 * Atlas UVs and cells for a group of props merged in order: `geometry` is the merged geometry
 * (each prop's vertices in turn, `counts[i]` of them for prop i, positions in world space).
 * Vertices that show no image keep their UV and get cover 0.
 */
export function atlasVertices(props: readonly Prop[], counts: readonly number[], geometry: THREE.BufferGeometry, atlas: Atlas = T.cel.atlas): AtlasVertices {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uvIn = geometry.getAttribute('uv');
  const uv = new Float32Array(position.count * 2);
  const cells = Object.fromEntries(ERAS.map((era) => [era, new Float32Array(position.count * 3)])) as Record<Era, Float32Array>;
  let at = 0;
  let buildings = 0;
  props.forEach((prop, i) => {
    const image = propImage(prop, buildings, atlas);
    if (image?.side) buildings++;
    for (let v = at; v < at + (counts[i] ?? 0); v++) {
      uv.set([uvIn.getX(v), uvIn.getY(v)], v * 2);
      if (!image) continue;
      const front = image.side === 0 || normal.getZ(v) * image.side > 0.5;
      if (!front) continue;
      if (image.side !== 0) uv.set(facadeUv(prop, image.side, position.getX(v), position.getY(v), atlas), v * 2);
      for (const era of ERAS) cells[era].set([...cellOf(image.cell[era], atlas), image.mix], v * 3);
    }
    at += counts[i] ?? 0;
  });
  return { uv, cells };
}

/** An sRGB byte (0..255) in linear light (0..1). */
function linear(byte: number): number {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * The mean brightness (linear luma) of each cell of an atlas image, from its RGBA bytes (sRGB, rows of
 * `width` pixels, cell row 0 first). Every `step`-th pixel each way is enough for a mean.
 */
export function cellMeans(pixels: ArrayLike<number>, width: number, atlas: Atlas = T.cel.atlas, step = 4): number[] {
  const lut = Array.from({ length: 256 }, (_, b) => linear(b));
  const size = atlas.cellPx;
  return Array.from({ length: atlas.columns * atlas.rows }, (_, index) => {
    const [column, row] = cellOf(index, atlas);
    let sum = 0;
    let n = 0;
    for (let y = row * size; y < (row + 1) * size; y += step) {
      for (let x = column * size; x < (column + 1) * size; x += step, n++) {
        const p = (y * width + x) * 4;
        sum += 0.2126 * (lut[pixels[p] ?? 0] ?? 0) + 0.7152 * (lut[pixels[p + 1] ?? 0] ?? 0) + 0.0722 * (lut[pixels[p + 2] ?? 0] ?? 0);
      }
    }
    return Math.max(sum / Math.max(n, 1), 1e-3);
  });
}

/** Draws one image into its cell, upside down (canvas row 0 becomes v = 0); a missing image leaves the cell grey. */
async function drawCell(g: CanvasRenderingContext2D, url: string, index: number, atlas: Atlas): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY' });
    const [column, row] = cellOf(index, atlas);
    g.drawImage(bitmap, column * atlas.cellPx, row * atlas.cellPx, atlas.cellPx, atlas.cellPx);
    bitmap.close();
  } catch {
    // no file or not an image: the cell stays plain grey, which adds no pattern
  }
}

/**
 * Paints the atlas images into one texture (fetch + createImageBitmap, so the page's load event does not
 * wait), then calls back with it and each cell's mean brightness. Without a 2D canvas nothing happens
 * and the decoration keeps its plain colours.
 */
export function loadAtlas(onReady: (texture: THREE.Texture, means: number[]) => void, atlas: Atlas = T.cel.atlas): void {
  const canvas = document.createElement('canvas');
  canvas.width = atlas.columns * atlas.cellPx;
  canvas.height = atlas.rows * atlas.cellPx;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return;
  g.fillStyle = atlas.blankGrey;
  g.fillRect(0, 0, canvas.width, canvas.height);
  void Promise.all(atlas.files.map((url, i) => drawCell(g, url, i, atlas))).then(() => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false; // the images were drawn upside down already
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    onReady(texture, cellMeans(g.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, atlas));
  });
}
