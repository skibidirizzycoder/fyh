// news.ts — what today's newspaper may say, worked out from the flags.
// The story logic is timeline.ts; this only turns its answers into an LLM
// prompt (facts, nothing invented) and picks the pre-written offline text.

import { causesOf, presentState } from './timeline.ts';
import type { Flags } from './timeline.ts';
import type { Article, StoryContent } from './types.ts';

/** Cache key for a flag set: order does not matter, so sort it. */
export function flagKey(flags: Flags): string {
  return [...flags].sort().join('|');
}

/** The true facts about the present, in plain sentences. */
export function newsFacts(content: StoryContent, flags: Flags): string[] {
  const present = presentState(content, flags);
  const active = content.changes.filter((c) => present[c.id]);
  if (active.length === 0) return [content.news.unchangedFact];
  const causes = causesOf(content, active.flatMap((c) => c.requires));
  return [
    ...active.map((c) => `${c.label}. ${c.line}`),
    ...causes.map((a, i) => `Back in 2004, step ${i + 1}: someone ${a.label}.`),
  ];
}

/** The full prompt sent to the LLM. */
export function newsPrompt(content: StoryContent, flags: Flags): string {
  const facts = newsFacts(content, flags).map((f) => `- ${f}`).join('\n');
  return `${content.news.brief}\n\nFacts:\n${facts}`;
}

/** The pre-written front page for these flags (first active change, else default). */
export function offlineNews(content: StoryContent, flags: Flags): Article {
  const present = presentState(content, flags);
  const change = content.changes.find((c) => present[c.id] && content.news.offline[c.id]);
  const fallback = content.news.offline.default ?? { headline: '', article: '' };
  return (change && content.news.offline[change.id]) || fallback;
}
