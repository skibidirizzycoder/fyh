// types.ts — the shape of src/story/content.json.

export interface Effects {
  show: string[]; // prop ids that appear
  hide: string[]; // prop ids that disappear
}

/** Something the player does in 2004. Doing it sets a flag with the same id. */
export interface PastAction {
  id: string;
  objectId: string; // the interactable prop you use to do it
  label: string; // finishes the sentence "Because you..."
  prompt: string; // shown when the object is targeted
  requires: string[]; // action ids that must be done first (the snowball)
  line: string; // dialogue when it succeeds
  lockedLine: string; // dialogue when requirements are missing
  effects: Effects;
}

/** Something different in the present, caused by past actions. */
export interface PresentChange {
  id: string;
  label: string;
  requires: string[]; // action ids
  line: string;
  effects: Effects;
}

export interface StoryContent {
  intro: string;
  travelLines: Record<string, string>;
  alreadyDoneLine: string;
  notHereLine: string;
  actions: PastAction[];
  changes: PresentChange[];
  ending: string;
}
