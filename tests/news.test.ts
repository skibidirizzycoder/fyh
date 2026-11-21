// news.test.ts — the newspaper's facts come from the timeline; replies are checked.
import { describe, expect, it } from 'vitest';
import { content } from '../src/story/content.ts';
import { extractJson, parseArticle } from '../src/news/article.ts';
import { flagKey, newsFacts, newsPrompt, offlineNews } from '../src/story/news.ts';
import { replayFlags } from '../src/story/timeline.ts';

const ALL = ['mira_take_cd', 'mira_play_cd']; // Mira's CD, fixed

describe('news facts and prompt', () => {
  it('with nothing done, reports the unchanged present', () => {
    expect(newsFacts(content, [])).toEqual([content.news.unchangedFact]);
  });

  it('a partial chain still reports the unchanged present', () => {
    expect(newsFacts(content, ['mira_take_cd'])).toEqual([content.news.unchangedFact]);
  });

  it('with the full chain, reports the change and its causes in snowball order', () => {
    const prompt = newsPrompt(content, ALL);
    expect(prompt).toContain(content.news.brief);
    expect(prompt).toContain('Hollow Records is open');
    const order = ['picked up', 'played it'].map((s) => prompt.indexOf(s));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i > 0)).toBe(true);
  });

  it('offline text follows the present state', () => {
    expect(offlineNews(content, [])).toEqual(content.news.offline.default);
    const gold = content.news.offline.gold_mira;
    const open = content.news.offline.rep_open;
    // Leads with the CD just fixed, then adds the shop's new reputation.
    expect(offlineNews(content, ALL)).toEqual({ headline: gold?.headline, article: `${gold?.article} ${open?.article}` });
  });

  it('cache key ignores order', () => {
    expect(flagKey(['mira_play_cd', 'mira_take_cd'])).toBe(flagKey(['mira_take_cd', 'mira_play_cd']));
    expect(flagKey([])).not.toBe(flagKey(['mira_take_cd']));
  });
});

describe('replayFlags (checks flags sent over the network)', () => {
  it('accepts flags that can happen, in order', () => {
    expect(replayFlags(content, ALL)).toEqual(ALL);
    expect(replayFlags(content, [])).toEqual([]);
  });

  it.each([
    ['unknown ids', ['mira_take_cd', 'hack']],
    ['an impossible order', ['mira_play_cd', 'mira_take_cd']],
    ['duplicates', ['mira_take_cd', 'mira_take_cd']],
    ['non-strings', [1]],
    ['not a list', 'mira_take_cd'],
    ['a missing value', undefined],
  ])('rejects %s', (_name, value) => {
    expect(replayFlags(content, value)).toBeNull();
  });
});

describe('article parsing', () => {
  it('finds JSON inside extra model words', () => {
    expect(extractJson('Sure! {"headline": "H", "article": "A."} Hope that helps.')).toEqual({ headline: 'H', article: 'A.' });
  });

  it('rejects text with no JSON, and JSON of the wrong shape', () => {
    expect(extractJson('no json here')).toBeNull();
    expect(parseArticle({ headline: 'H' })).toBeNull();
    expect(parseArticle({ headline: '  ', article: 'A' })).toBeNull();
  });

  it('trims and caps lengths', () => {
    const a = parseArticle({ headline: ` ${'x'.repeat(500)} `, article: 'ok' });
    expect(a?.headline.length).toBeLessThanOrEqual(100);
  });
});
