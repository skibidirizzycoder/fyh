// validate.ts — refuses broken story data.
// Every requirement must name an existing action, every effect an existing
// prop, every action an interactable prop in its own 2004 moment, and
// requirements must not loop.

import type { StoryContent } from './types.ts';

export interface PropInfo {
  id: string;
  eras: readonly string[];
  moments?: readonly string[] | undefined;
  interactable: boolean;
}

/** Lists duplicate values. */
function duplicates(ids: string[]): string[] {
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

/** Checks requirements and effects point at things that exist. */
function checkReferences(content: StoryContent, props: ReadonlyMap<string, PropInfo>): string[] {
  const errors: string[] = [];
  const actionIds = new Set(content.actions.map((a) => a.id));
  for (const item of [...content.actions, ...content.changes]) {
    const needs = [...item.requires, ...('minOf' in item && item.minOf ? item.minOf.of : [])];
    needs.filter((req) => !actionIds.has(req)).forEach((req) => errors.push(`"${item.id}" requires unknown action "${req}"`));
    [...item.effects.show, ...item.effects.hide]
      .filter((propId) => !props.has(propId))
      .forEach((propId) => errors.push(`"${item.id}" has an effect on unknown prop "${propId}"`));
  }
  return errors;
}

/** Checks each action uses an interactable prop that is in its 2004 moment. */
function checkActionObjects(content: StoryContent, props: ReadonlyMap<string, PropInfo>): string[] {
  const errors: string[] = [];
  const moments = new Set(content.cds.map((c) => c.moment));
  for (const action of content.actions) {
    const prop = props.get(action.objectId);
    if (!action.moment || !moments.has(action.moment)) errors.push(`action "${action.id}" has unknown moment "${action.moment}"`);
    if (!prop) errors.push(`action "${action.id}" uses unknown object "${action.objectId}"`);
    else if (!prop.interactable) errors.push(`action "${action.id}" uses "${prop.id}", which is not interactable`);
    else if (!prop.eras.includes('2004')) errors.push(`action "${action.id}" uses "${prop.id}", which is not in 2004`);
    else if (prop.moments && action.moment && !prop.moments.includes(action.moment)) {
      errors.push(`action "${action.id}" happens in "${action.moment}" but "${prop.id}" is not in that moment`);
    }
  }
  return errors;
}

/** Returns a list of problems; an empty list means the content is valid. */
export function validateContent(content: StoryContent, props: readonly PropInfo[]): string[] {
  const propById = new Map(props.map((p) => [p.id, p]));
  const errors: string[] = [];
  duplicates([...content.actions, ...content.changes].map((x) => x.id)).forEach((id) => errors.push(`duplicate id "${id}"`));
  duplicates(content.cds.map((c) => c.id)).forEach((id) => errors.push(`duplicate CD "${id}"`));
  duplicates(content.cds.map((c) => c.moment)).forEach((m) => errors.push(`two CDs share the moment "${m}"`));
  errors.push(...checkReferences(content, propById), ...checkActionObjects(content, propById));

  const changeIds = new Set(content.changes.map((c) => c.id));
  if (!content.news.offline.default) errors.push('news.offline needs a "default" entry');
  Object.keys(content.news.offline)
    .filter((key) => key !== 'default' && !changeIds.has(key))
    .forEach((key) => errors.push(`news.offline has unknown change "${key}"`));
  if (!changeIds.has(content.endingChange)) errors.push(`endingChange "${content.endingChange}" is not a change`);

  errors.push(...findCycles(content));
  return errors;
}

/** Reports requirement loops (A needs B, B needs A), which could never be done. */
function findCycles(content: StoryContent): string[] {
  const errors: string[] = [];
  const requiresOf = new Map(content.actions.map((a) => [a.id, a.requires]));
  const walk = (id: string, path: string[]): void => {
    if (path.includes(id)) {
      errors.push(`requirement loop: ${[...path, id].join(' -> ')}`);
      return;
    }
    (requiresOf.get(id) ?? []).forEach((req) => walk(req, [...path, id]));
  };
  content.actions.forEach((a) => walk(a.id, []));
  return errors;
}
