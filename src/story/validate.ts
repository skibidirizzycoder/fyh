// validate.ts — refuses broken story data.
// Every requirement must name an existing action, every effect an existing
// prop, every action an interactable 2004 prop, and requirements must not loop.

import type { StoryContent } from './types.ts';

export interface PropInfo {
  id: string;
  eras: readonly string[];
  interactable: boolean;
}

/** Returns a list of problems; an empty list means the content is valid. */
export function validateContent(content: StoryContent, props: readonly PropInfo[]): string[] {
  const errors: string[] = [];
  const actionIds = new Set(content.actions.map((a) => a.id));
  const propById = new Map(props.map((p) => [p.id, p]));
  const allIds = [...content.actions, ...content.changes].map((x) => x.id);

  allIds.filter((id, i) => allIds.indexOf(id) !== i).forEach((id) => errors.push(`duplicate id "${id}"`));

  for (const item of [...content.actions, ...content.changes]) {
    for (const req of item.requires) {
      if (!actionIds.has(req)) errors.push(`"${item.id}" requires unknown action "${req}"`);
    }
    for (const propId of [...item.effects.show, ...item.effects.hide]) {
      if (!propById.has(propId)) errors.push(`"${item.id}" has an effect on unknown prop "${propId}"`);
    }
  }

  for (const action of content.actions) {
    const prop = propById.get(action.objectId);
    if (!prop) errors.push(`action "${action.id}" uses unknown object "${action.objectId}"`);
    else if (!prop.interactable) errors.push(`action "${action.id}" uses "${prop.id}", which is not interactable`);
    else if (!prop.eras.includes('2004')) errors.push(`action "${action.id}" uses "${prop.id}", which is not in 2004`);
  }

  const changeIds = new Set(content.changes.map((c) => c.id));
  if (!content.news.offline.default) errors.push('news.offline needs a "default" entry');
  for (const key of Object.keys(content.news.offline)) {
    if (key !== 'default' && !changeIds.has(key)) errors.push(`news.offline has unknown change "${key}"`);
  }

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
