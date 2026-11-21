// shapes.test.ts — bevelled boxes made at their real size, and the contact-shadow blobs.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { T } from '../src/tuning.ts';
import { GROUND, PROPS, type Prop } from '../src/world/layout.ts';
import { bevelRadius, blobAlpha, castsBlob, createBlobs, createShapes } from '../src/world/shapes.ts';

const prop = (id: string): Prop => [GROUND, ...PROPS].find((p) => p.id === id) as Prop;

describe('bevelled boxes', () => {
  it('bevel = bevelRatio of the shortest side, capped for big walls, none for thin panels', () => {
    expect(bevelRadius([0.4, 0.5, 0.3])).toBeCloseTo(0.3 * T.cel.bevelRatio, 9);
    expect(bevelRadius([8, 4, 1])).toBe(T.cel.bevelMax);
    expect(bevelRadius([0.4, 0.55, 0.02])).toBe(0); // a flyer stays a plain box
  });

  it('is made at the prop\'s real size (bevels never stretch), once per size, indexed for merging', () => {
    const shapes = createShapes();
    const g = shapes.box([8, 4, 1]);
    g.computeBoundingBox();
    const size = g.boundingBox?.getSize(new THREE.Vector3()).toArray() ?? [];
    size.forEach((v, i) => expect(v).toBeCloseTo([8, 4, 1][i] ?? -1, 6));
    expect(shapes.box([8, 4, 1])).toBe(g);
    shapes.box([1, 1, 1]);
    expect(shapes.count()).toBe(2);
    expect(g.index).not.toBeNull();
    expect(shapes.box([0.4, 0.55, 0.02]).index).not.toBeNull();
    expect(shapes.cylinder.index).not.toBeNull();
    shapes.dispose();
  });
});

describe('contact shadows', () => {
  it('standing props get one, flat or raised things do not', () => {
    for (const id of ['shop_wall', 'bench', 'old_car', 'lamp_post', 'payphone']) expect(castsBlob(prop(id)), id).toBe(true);
    for (const id of ['ground', 'shop_sign', 'window_display']) expect(castsBlob(prop(id)), id).toBe(false);
  });

  it('the blob is opaque in the middle and fades to nothing at the edge', () => {
    const px = 32;
    const a = blobAlpha(px, 0.6);
    expect(a[(px / 2) * px + px / 2]).toBe(255);
    expect(a[0]).toBe(0);
    const row = Array.from(a.slice((px / 2) * px + px / 2, (px / 2) * px + px)); // centre to the right edge
    row.forEach((v, i) => { if (i > 0) expect(v).toBeLessThanOrEqual(row[i - 1] ?? 255); });
  });

  it('all blobs are ONE instanced mesh: one per standing prop plus the player; hidden props get none', () => {
    const props = [GROUND, ...PROPS];
    const blobs = createBlobs(props);
    const casters = props.filter((p) => castsBlob(p));
    expect(blobs.mesh.count).toBe(casters.length + 1);
    blobs.show((p) => p.id === 'bench');
    const m = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    const bench = casters.findIndex((p) => p.id === 'bench');
    blobs.mesh.getMatrixAt(bench, m);
    scale.setFromMatrixScale(m);
    expect(scale.x).toBeCloseTo(prop('bench').size[0] + 2 * T.cel.blobMargin, 6);
    blobs.mesh.getMatrixAt(casters.findIndex((p) => p.id === 'shop_wall'), m);
    expect(new THREE.Vector3().setFromMatrixScale(m).x).toBeLessThan(1e-5);
    blobs.follow(1, 2);
    blobs.mesh.getMatrixAt(casters.length, m);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    [1, T.cel.blobY, 2].forEach((v, i) => expect(pos.toArray()[i]).toBeCloseTo(v, 6)); // stored as 32-bit floats
    blobs.dispose();
  });
});
