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

/** Lists every pair of boxes that would z-fight, as "a / b" strings. */
export function findZFighting(boxes: readonly Box[], minGap: number): string[] {
  const clashes: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) continue;
      const ba = bounds(a);
      const bb = bounds(b);
      if ([0, 1, 2].some((axis) => facesClash(ba, bb, axis, minGap))) clashes.push(`${a.id} / ${b.id}`);
    }
  }
  return clashes;
}
