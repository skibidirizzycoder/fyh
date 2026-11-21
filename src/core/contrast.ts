// contrast.ts — WCAG contrast ratio, measured from rendered pixels.
// Used by the smoke test to prove text is readable (>= 4.5:1).

export type Rgb = readonly [number, number, number];

/** Converts one 0-255 sRGB channel to linear light (WCAG 2 formula). */
function linear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance: 0 for black, 1 for white. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Contrast ratio between two colours: 1 (same) up to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface TextContrast {
  ratio: number;
  background: Rgb;
  text: Rgb;
}

/**
 * Measures text contrast inside a box of RGBA pixels.
 * Background = the most common colour; text = the pixel that differs most from it.
 */
export function measureTextContrast(rgba: ArrayLike<number>): TextContrast {
  const pixels: Rgb[] = [];
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    pixels.push([rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0]);
  }
  const background = mostCommon(pixels);
  let text: Rgb = background;
  let ratio = 1;
  for (const p of pixels) {
    const r = contrastRatio(p, background);
    if (r > ratio) {
      ratio = r;
      text = p;
    }
  }
  return { ratio, background, text };
}

/** Returns the colour that appears most often. */
function mostCommon(pixels: Rgb[]): Rgb {
  const counts = new Map<string, number>();
  let best: Rgb = pixels[0] ?? [0, 0, 0];
  let bestCount = 0;
  for (const p of pixels) {
    const key = p.join(',');
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count > bestCount) {
      bestCount = count;
      best = p;
    }
  }
  return best;
}
