// content.ts — builds the whole story from content.json + one file per CD.
// It also makes the "today" changes for you:
//   gold_<cd>       when that CD's last action is done (shows the prop gold_<cd>)
//   reputation      levels from content.json, when enough CDs are fixed
// Add a CD: create src/story/cds/<id>.json and add one import + list entry below.

import base from './content.json' with { type: 'json' };
import kbit from './cds/kbit.json' with { type: 'json' };
import mira from './cds/mira.json' with { type: 'json' };
import staticCd from './cds/static.json' with { type: 'json' };
import type { Article, BaseContent, CdFile, LoadedCd, PastAction, PresentChange, StoryContent } from './types.ts';

/** The CDs, in the order they appear in the phone menu. */
export const CD_FILES: CdFile[] = [mira, staticCd, kbit];

/** The id of the action that fixes a CD (its last action). */
function finalActionOf(file: CdFile): string {
  return file.actions.at(-1)?.id ?? `${file.cd.id}_has_no_actions`;
}

/** The "gold disc" change for one CD. */
function goldChange(cd: LoadedCd): PresentChange {
  return {
    id: `gold_${cd.id}`,
    label: `${cd.artist}'s "${cd.title}" went gold`,
    requires: [cd.finalAction],
    line: cd.today ?? `${cd.artist}'s "${cd.title}" went gold.`,
    effects: { show: [`gold_${cd.id}`], hide: [] },
  };
}

/** Combines the shared text and the CD files into one StoryContent. */
export function buildContent(shared: BaseContent, files: CdFile[]): StoryContent {
  const cds: LoadedCd[] = files.map((f) => ({ ...f.cd, finalAction: finalActionOf(f) }));
  const actions: PastAction[] = files.flatMap((f) => f.actions.map((a) => ({ ...a, cd: f.cd.id, moment: a.moment ?? f.cd.moment })));
  const finals = cds.map((c) => c.finalAction);
  const levels: PresentChange[] = shared.reputation.map((r) => ({
    id: r.id, label: r.label, requires: [], minOf: { count: r.count, of: finals }, line: r.line, effects: r.effects,
  }));
  const offline: Record<string, Article> = { default: shared.news.offline.default };
  files.forEach((f) => { offline[`gold_${f.cd.id}`] = f.offline; });
  shared.reputation.forEach((r) => { offline[r.id] = r.offline; });
  return {
    intro: shared.intro,
    travelLines: shared.travelLines,
    alreadyDoneLine: shared.alreadyDoneLine,
    notHereLine: shared.notHereLine,
    ending: shared.ending,
    endingChange: shared.endingChange,
    cds,
    actions,
    changes: [...cds.map(goldChange), ...levels],
    news: { brief: shared.news.brief, unchangedFact: shared.news.unchangedFact, offline },
  };
}

/** The story the game uses. */
export const content: StoryContent = buildContent(base, CD_FILES);
