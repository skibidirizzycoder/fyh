// zfight.ts — finds surfaces that would z-fight (flicker).
// Two boxes z-fight when a face of one lies in (almost) the same plane as a
// face of the other AND those faces overlap. Cylinders are treated as boxes.

export interface Box {
  id: string;
  pos: readonly [number, number, number];
  size: readonly [number, number, number];
}

interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

function bounds(b: Box): Bounds {
  const min = [0, 1, 2].map((i) => (b.pos[i] ?? 0) - (b.size[i] ?? 0) / 2) as [number, number, number];
  const max = [0, 1, 2].map((i) => (b.pos[i] ?? 0) + (b.size[i] ?? 0) / 2) as [number, number, number];
  return { min, max };
}

/** True when two ranges overlap by more than `eps` (just touching does not count). */
function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number, eps: number): boolean {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin) > eps;
}

/** True when boxes a and b have overlapping faces closer than `minGap` on `axis`. */
function facesClash(a: Bounds, b: Bounds, axis: number, minGap: number): boolean {
  const others = [0, 1, 2].filter((i) => i !== axis);
  const overlapOthers = others.every((i) =>
    rangesOverlap(a.min[i] ?? 0, a.max[i] ?? 0, b.min[i] ?? 0, b.max[i] ?? 0, 1e-6),
  );
  if (!overlapOthers) return false;
  const aFaces = [a.min[axis] ?? 0, a.max[axis] ?? 0];
  const bFaces = [b.min[axis] ?? 0, b.max[axis] ?? 0];
  return aFaces.some((fa) => bFaces.some((fb) => Math.abs(fa - fb) < minGap - 1e-9));
}

/**
 * Lists every pair of boxes that would z-fight, as "a / b" strings (a before b in `boxes`, pairs in
 * that order). Boxes are swept along x: once a box starts further right than another ends (plus
 * minGap), neither their x faces nor their x ranges can meet, so the pair is skipped.
 */
export function findZFighting(boxes: readonly Box[], minGap: number): string[] {
  const sorted = boxes.map((box, index) => ({ index, b: bounds(box) })).sort((p, q) => p.b.min[0] - q.b.min[0]);
  const pairs: [number, number][] = [];
  for (let s = 0; s < sorted.length; s++) {
    const a = sorted[s];
    if (!a) continue;
    for (let t = s + 1; t < sorted.length; t++) {
      const c = sorted[t];
      if (!c || c.b.min[0] > a.b.max[0] + minGap) break; // everything after c starts even further right
      if ([0, 1, 2].some((axis) => facesClash(a.b, c.b, axis, minGap))) pairs.push(a.index < c.index ? [a.index, c.index] : [c.index, a.index]);
    }
  }
  pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return pairs.map(([i, j]) => `${boxes[i]?.id ?? ''} / ${boxes[j]?.id ?? ''}`);
}
