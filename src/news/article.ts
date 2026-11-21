// article.ts — checks that a newspaper reply has the right shape.
// Used by the server (on the LLM's reply) and the browser (on the server's reply).
// LLM text is untrusted data: we only ever show it with textContent.

import type { Article } from '../story/types.ts';
import { T } from '../tuning.ts';

/** Returns a clean Article, or null when the value is not one. */
export function parseArticle(value: unknown): Article | null {
  if (typeof value !== 'object' || value === null) return null;
  const { headline, article } = value as Record<string, unknown>;
  if (typeof headline !== 'string' || typeof article !== 'string') return null;
  const h = headline.trim().slice(0, T.news.headlineMaxChars);
  const a = article.trim().slice(0, T.news.articleMaxChars);
  return h && a ? { headline: h, article: a } : null;
}

/** Finds the first {...} JSON object inside model text (models sometimes add words around it). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
