// timeline.ts — past actions are flags; the present is a pure function of them.
// Nothing here keeps hidden state: every function takes the flags and returns
// a new answer. Flags are the list of action ids done, in the order done.

import type { PastAction, PresentChange, StoryContent } from './types.ts';

export type Flags = readonly string[];

export type ActionResult =
  | { ok: true; action: PastAction; flags: Flags }
  | { ok: false; reason: 'unknown' | 'already-done'; flags: Flags }
  | { ok: false; reason: 'locked'; action: PastAction; missing: string[]; flags: Flags };

/** Finds the action that uses a given interactable object, if any. */
export function actionForObject(content: StoryContent, objectId: string): PastAction | undefined {
  return content.actions.find((a) => a.objectId === objectId);
}

/** Lists the requirements of an action that are not yet done. */
export function missingRequirements(action: PastAction, flags: Flags): string[] {
  return action.requires.filter((id) => !flags.includes(id));
}

/** Tries to do an action. Returns the new flags; never changes the old ones. */
export function doAction(content: StoryContent, flags: Flags, actionId: string): ActionResult {
  const action = content.actions.find((a) => a.id === actionId);
  if (!action) return { ok: false, reason: 'unknown', flags };
  if (flags.includes(actionId)) return { ok: false, reason: 'already-done', flags };
  const missing = missingRequirements(action, flags);
  if (missing.length > 0) return { ok: false, reason: 'locked', action, missing, flags };
  return { ok: true, action, flags: [...flags, actionId] };
}

/** True when a present-day change's requirements are met: all of `requires`, and at least `minOf.count` of `minOf.of`. */
export function isChangeActive(change: PresentChange, flags: Flags): boolean {
  const all = change.requires.every((id) => flags.includes(id));
  const some = !change.minOf || change.minOf.of.filter((id) => flags.includes(id)).length >= change.minOf.count;
  return all && some;
}

/** The done actions that a change depends on (its direct causes). */
export function changeCauses(change: PresentChange, flags: Flags): string[] {
  const fromMin = change.minOf ? change.minOf.of.filter((id) => flags.includes(id)) : [];
  return [...change.requires, ...fromMin];
}

/** Ids of the CDs that are fixed (their last action is done), in CD order. */
export function fixedCds(content: StoryContent, flags: Flags): string[] {
  return content.cds.filter((c) => flags.includes(c.finalAction)).map((c) => c.id);
}

/** The shop's reputation level today: how many CDs are fixed. */
export function reputationLevel(content: StoryContent, flags: Flags): number {
  return fixedCds(content, flags).length;
}

/** The present day: which changes are active. A pure function of the flags. */
export function presentState(content: StoryContent, flags: Flags): Record<string, boolean> {
  return Object.fromEntries(content.changes.map((c) => [c.id, isChangeActive(c, flags)]));
}

/**
 * Every past action that led to `ids`, following requirements back to the start.
 * Returned in snowball order: earliest cause first.
 */
export function causesOf(content: StoryContent, ids: readonly string[]): PastAction[] {
  const ordered: PastAction[] = [];
  const visit = (id: string): void => {
    const action = content.actions.find((a) => a.id === id);
    if (!action || ordered.includes(action)) return;
    action.requires.forEach(visit); // causes before effects
    ordered.push(action);
  };
  ids.forEach(visit);
  return ordered;
}

/** Prop ids made visible or hidden by done actions and active changes. */
export function propOverrides(content: StoryContent, flags: Flags): { shown: Set<string>; hidden: Set<string> } {
  const shown = new Set<string>();
  const hidden = new Set<string>();
  const apply = (fx: { show: string[]; hide: string[] }): void => {
    fx.show.forEach((id) => shown.add(id));
    fx.hide.forEach((id) => hidden.add(id));
  };
  content.actions.filter((a) => flags.includes(a.id)).forEach((a) => apply(a.effects));
  content.changes.filter((c) => isChangeActive(c, flags)).forEach((c) => apply(c.effects));
  return { shown, hidden };
}

/**
 * Checks a flag list from outside (e.g. a network request): every id must be a
 * known action and the list must replay in order. Returns the flags, or null.
 */
export function replayFlags(content: StoryContent, value: unknown): Flags | null {
  if (!Array.isArray(value) || value.length > content.actions.length) return null;
  let flags: Flags = [];
  for (const id of value) {
    if (typeof id !== 'string') return null;
    const result = doAction(content, flags, id);
    if (!result.ok) return null;
    flags = result.flags;
  }
  return flags;
}
