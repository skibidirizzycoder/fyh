// shapes.ts — the geometry props are drawn with, and their soft contact shadows.
//
// Boxes are bevelled (three's RoundedBoxGeometry), made at each prop's real size and cached by
// size, so the bevels never stretch. The bevel radius is T.cel.bevelRatio of the shortest side,
// at most T.cel.bevelMax; too thin a box (radius under T.cel.bevelMin) stays a plain box.
// Cylinders are one shared, smooth unit cylinder that each prop scales.
//
// Contact shadows: a soft dark blob (radial gradient) on the ground under every standing prop and
// under the player, all in ONE InstancedMesh (one draw call). Hidden props get a zero-size blob.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { T } from '../tuning.ts';
import type { Prop } from './layout.ts';

type Size = readonly [number, number, number];

/** Bevel radius for a box of this size (0 = too thin to bevel: a plain box). */
export function bevelRadius(size: Size, cel = T.cel): number {
  const r = Math.min(Math.min(...size) * cel.bevelRatio, cel.bevelMax);
  return r < cel.bevelMin ? 0 : r;
}

export interface Shapes {
  /** The box geometry for a size: bevelled (or plain when thin), made once per size. */
  box(size: Size): THREE.BufferGeometry;
  /** The shared unit cylinder (diameter 1, height 1), scaled by each prop. */
  readonly cylinder: THREE.BufferGeometry;
  /** How many box geometries were made (for tests). */
  count(): number;
  dispose(): void;
}

/** Creates the geometry cache. Every geometry is indexed, so decoration can be merged. */
export function createShapes(): Shapes {
  const boxes = new Map<string, THREE.BufferGeometry>();
  const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, T.cel.cylinderSegments);
  return {
    box(size) {
      const key = size.join('x');
      let g = boxes.get(key);
      if (!g) {
        const r = bevelRadius(size);
        g = r > 0 ? mergeVertices(new RoundedBoxGeometry(...size, T.cel.bevelSegments, r)) : new THREE.BoxGeometry(...size);
        boxes.set(key, g);
      }
      return g;
    },
    cylinder,
    count: () => boxes.size,
    dispose() {
      boxes.forEach((g) => g.dispose());
      boxes.clear();
      cylinder.dispose();
    },
  };
}

// ---------- contact shadows ----------

/** True for a prop that stands on the ground and is tall enough to get a contact shadow. */
export function castsBlob(p: Prop, cel = T.cel): boolean {
  const bottom = p.pos[1] - p.size[1] / 2;
  return p.id !== 'ground' && bottom <= cel.blobMaxBottom && p.size[1] >= cel.blobMinHeight;
}

/** Alpha (0..255) of a px x px blob: opaque in the middle, fading to 0 at the edge from `softness`. */
export function blobAlpha(px: number, softness: number): Uint8Array {
  const out = new Uint8Array(px * px);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const r = Math.hypot((x + 0.5) / px - 0.5, (y + 0.5) / px - 0.5) * 2; // 0 centre, 1 edge
      const t = Math.min(1, Math.max(0, (1 - r) / softness)); // 0 at the edge, 1 inside
      out[y * px + x] = Math.round(t * t * (3 - 2 * t) * 255); // smoothstep
    }
  }
  return out;
}

/** The blob texture: white, with the radial alpha. */
function blobTexture(): THREE.DataTexture {
  const px = T.cel.blobTexturePx;
  const alpha = blobAlpha(px, T.cel.blobSoftness);
  const rgba = new Uint8Array(px * px * 4).fill(255);
  alpha.forEach((a, i) => { rgba[i * 4 + 3] = a; });
  const t = new THREE.DataTexture(rgba, px, px, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export interface Blobs {
  mesh: THREE.InstancedMesh;
  /** Shows the blobs of the props in `visible` (by id); the rest shrink to nothing. */
  show(visible: (p: Prop) => boolean): void;
  /** Puts the player's blob under the player. */
  follow(x: number, z: number): void;
  dispose(): void;
}

/** One instanced mesh of blobs: one per standing prop, plus the last one for the player. */
export function createBlobs(props: readonly Prop[]): Blobs {
  const casters = props.filter((p) => castsBlob(p));
  const c = T.cel;
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); // lying flat, facing up
  const map = blobTexture();
  const material = new THREE.MeshBasicMaterial({ color: c.blobColor, map, transparent: true, opacity: c.blobOpacity, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geometry, material, casters.length + 1);
  mesh.name = 'contact_shadows';
  mesh.frustumCulled = false; // the blobs are spread over the whole street
  const m = new THREE.Matrix4();
  const player = casters.length;

  /** Sets one blob: centre (x, z) and footprint (w, d); w = 0 hides it. */
  function put(i: number, x: number, z: number, w: number, d: number): void {
    m.makeScale(Math.max(w, 1e-6), 1, Math.max(d, 1e-6)).setPosition(x, c.blobY, z);
    mesh.setMatrixAt(i, m);
  }

  /** A prop's footprint on the ground (a lying cylinder is turned onto its axis). */
  function footprint(p: Prop): [number, number] {
    const [w, h, d] = p.size;
    if (p.axis === 'x') return [h, d];
    if (p.axis === 'z') return [w, h];
    return [w, d];
  }

  const blobs: Blobs = {
    mesh,
    show(visible) {
      casters.forEach((p, i) => {
        const [w, d] = visible(p) ? footprint(p) : [0, 0];
        put(i, p.pos[0], p.pos[2], w && w + 2 * c.blobMargin, d && d + 2 * c.blobMargin); // hidden stays 0
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    follow(x, z) {
      put(player, x, z, c.playerBlob, c.playerBlob);
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      map.dispose();
      mesh.dispose();
    },
  };
  blobs.show(() => false); // nothing shows until the first scene is applied...
  put(player, 0, 0, 0, 0); // ...or the player is found
  return blobs;
}
