// types.ts — the shape of the story data.
// The story is: src/story/content.json (shared text) + one file per CD in src/story/cds/.
// src/story/content.ts combines them into one StoryContent.

export interface Effects {
  show: string[]; // prop ids that appear
  hide: string[]; // prop ids that disappear
}

/** Something the player does in a 2004 moment. Doing it sets a flag with the same id. */
export interface PastAction {
  id: string;
  moment?: string; // the 2004 moment it happens in (filled in from the CD if missing)
  cd?: string; // which CD it belongs to (filled in by content.ts)
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
  requires: string[]; // ALL of these action ids must be done...
  minOf?: { count: number; of: string[] }; // ...and at least `count` of these
  line: string;
  effects: Effects;
}

/** A newspaper front page. */
export interface Article {
  headline: string;
  article: string;
}

/** One unpopular CD and the 2004 moment where you can fix it. */
export interface Cd {
  id: string;
  artist: string;
  title: string;
  moment: string; // id of its 2004 moment, e.g. "street_gig"
  date: string; // shown in the phone menu, e.g. "2 July 2004"
  situation: string; // what is going wrong in that moment (shown when you arrive)
  fixedSituation?: string; // what you see when you come back after fixing it (missing: content.json's "fixedSituation")
  today?: string; // what is different today once this CD is fixed (optional)
}

/** The file for one CD: src/story/cds/<id>.json */
export interface CdFile {
  cd: Cd;
  actions: PastAction[]; // the CD is "fixed" when its LAST action is done
  offline: Article; // newspaper text when this CD is fixed and the LLM is unavailable
}

/** A reputation level of the shop today, reached by fixing `count` CDs. */
export interface ReputationLevel {
  id: string;
  count: number;
  label: string;
  line: string;
  effects: Effects;
  offline: Article;
}

/** Text for the present-day newspaper. The LLM writes it; these are the facts and fallbacks. */
export interface NewsContent {
  brief: string; // instructions for the LLM
  unchangedFact: string; // what the paper reports when no change is active
  offline: Record<string, Article>; // "default" plus one per change id, shown when the LLM is unavailable
}

/** Text for the CD player outside the shop today. May use {artist}, {title} and {date}. */
export interface CdPlayerText {
  prompt: string; // shown when a CD is targeted, e.g. "Put Mira's CD in the player"
  line: string; // dialogue while the CD goes in, before you travel
  phoneLockedLine: string; // choosing a moment on the phone that still needs its CD
}

/** src/story/content.json: the text shared by every CD. */
export interface BaseContent {
  intro: string;
  travelLines: { present: string; past: string }; // past may use {date} and {situation}
  fixedSituation: string; // {situation} on coming back to a fixed moment, for CDs without their own; may use {artist}
  cdPlayer: CdPlayerText;
  alreadyDoneLine: string;
  notHereLine: string;
  ending: string;
  endingChange: string; // the change that ends the game when you reach today with it
  reputation: ReputationLevel[];
  news: { brief: string; unchangedFact: string; offline: { default: Article } };
}

/** A CD after loading: knows which action fixes it. */
export interface LoadedCd extends Cd {
  finalAction: string;
}

/** Everything the game uses, built by content.ts. */
export interface StoryContent {
  intro: string;
  travelLines: { present: string; past: string };
  fixedSituation: string;
  cdPlayer: CdPlayerText;
  alreadyDoneLine: string;
  notHereLine: string;
  ending: string;
  endingChange: string;
  cds: LoadedCd[];
  actions: PastAction[];
  changes: PresentChange[];
  news: NewsContent;
}
