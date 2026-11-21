// dates.ts — small date helpers with no page or CSS imports, so Node scripts (smoke checks) can use them too.

/** "13 December 2002" -> "13 Dec 2002" (fits the closed phone's small outer screen). */
export function shortDate(date: string): string {
  return date.replace(/\b([A-Z][a-z]{2})[a-z]+\b/, '$1');
}
