// news.ts — what today's newspaper may say, worked out from the flags.
// The story logic is timeline.ts; this only turns its answers into an LLM
// prompt (facts, nothing invented) and picks the pre-written offline text.

import { causesOf, changeCauses, presentState } from './timeline.ts';
import type { Flags } from './timeline.ts';
import type { Article, PresentChange, StoryContent } from './types.ts';

/** Cache key for a flag set: order does not matter, so sort it. */
export function flagKey(flags: Flags): string {
  return [...flags].sort().join('|');
}

/** The true facts about the present, in plain sentences. */
export function newsFacts(content: StoryContent, flags: Flags): string[] {
  const present = presentState(content, flags);
  const active = content.changes.filter((c) => present[c.id]);
  if (active.length === 0) return [content.news.unchangedFact];
  const causes = causesOf(content, active.flatMap((c) => changeCauses(c, flags)));
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

/** The step (index in flags) at which a change became true. */
function activatedAt(change: PresentChange, flags: Flags): number {
  const allAt = Math.max(-1, ...change.requires.map((id) => flags.indexOf(id)));
  if (!change.minOf) return allAt;
  const hits = change.minOf.of.map((id) => flags.indexOf(id)).filter((i) => i >= 0).sort((a, b) => a - b);
  return Math.max(allAt, hits[change.minOf.count - 1] ?? -1);
}

/**
 * The pre-written front page for these flags, used when the LLM is unavailable.
 * Headline: the change that happened most recently (ties go to the earlier change in the
 * list, so a CD's gold disc beats the reputation level it caused). Article: that change's
 * text, plus the biggest change (the last active one in the list) if that is a different one.
 */
export function offlineNews(content: StoryContent, flags: Flags): Article {
  const present = presentState(content, flags);
  const active = content.changes.filter((c) => present[c.id] && content.news.offline[c.id]);
  const fallback = content.news.offline.default ?? { headline: '', article: '' };
  const newest = active.reduce<PresentChange | null>((best, c) => (!best || activatedAt(c, flags) > activatedAt(best, flags) ? c : best), null);
  const lead = newest && content.news.offline[newest.id];
  if (!newest || !lead) return fallback;
  const biggest = active.at(-1);
  const extra = biggest && biggest !== newest ? content.news.offline[biggest.id] : undefined;
  return { headline: lead.headline, article: extra ? `${lead.article} ${extra.article}` : lead.article };
}
