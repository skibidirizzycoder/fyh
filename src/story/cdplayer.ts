// cdplayer.ts — the CD player outside the shop today: the way into each CD's 2004 moment.
// Putting a CD in is NOT a story action (it sets no flag, so the card, the paper and the
// reputation never mention it): game.ts announces `cd-insert` at once and travels to the
// CD's moment T.cdPlayer.insertSec later. Its props are in src/world/props/player.ts; its
// text ("cdPlayer" in content.json) may use {artist}, {title} and {date}.

import type { LoadedCd, PastAction, StoryContent } from './types.ts';

const PREFIX = 'today_cd_';

/** The id of a CD's interactable by the CD player, e.g. "today_cd_mira". */
export function cdObjectId(cdId: string): string {
  return `${PREFIX}${cdId}`;
}

/** The id of the gold copy that replaces it once the CD is fixed (decoration). */
export function goldCdObjectId(cdId: string): string {
  return `${PREFIX}${cdId}_gold`;
}

/** The CD whose interactable this is, if it is one of the CDs by the player. */
export function cdForObject(content: StoryContent, objectId: string): LoadedCd | undefined {
  return content.cds.find((c) => cdObjectId(c.id) === objectId);
}

/** Fills {artist}, {title} and {date} with a CD's details. */
export function fillCdText(text: string, cd: LoadedCd): string {
  return text.replaceAll('{artist}', cd.artist).replaceAll('{title}', cd.title).replaceAll('{date}', cd.date);
}

/** What you see on coming back to a moment: its "before" situation, or once fixed, how it is now. */
export function situationOf(content: StoryContent, cd: LoadedCd, fixed: boolean): string {
  return fixed ? fillCdText(cd.fixedSituation ?? content.fixedSituation, cd) : cd.situation;
}

/**
 * A copy of the story for the HUD (src/ui/hud.ts), which looks the E prompt up in `actions`:
 * it adds one prompt-only entry per CD by the player. The game's rules never see these.
 */
export function withCdPrompts(content: StoryContent): StoryContent {
  const prompts: PastAction[] = content.cds.map((cd) => ({
    id: `${cdObjectId(cd.id)}_prompt`, objectId: cdObjectId(cd.id), label: '', prompt: fillCdText(content.cdPlayer.prompt, cd),
    requires: [], line: '', lockedLine: '', effects: { show: [], hide: [] },
  }));
  return { ...content, actions: [...content.actions, ...prompts] };
}
