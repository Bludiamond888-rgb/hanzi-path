// SM-2 spaced repetition for the Cards tab (ported from Hanzi Flashcards), day-granular. Pure functions.
export type Grade = 0 | 1 | 2 | 3; // Again, Hard, Good, Easy
export type Card = { ef: number; ivl: number; reps: number; due: string; lapses: number; seen: string };
export type Mode = 'hanzi' | 'meaning' | 'pinyin' | 'mixed';
export type Settings = { newPerDay: number; mode: Mode; autoSpeak: boolean; writeFirst: boolean };
export type State = { v: 1; cards: Record<string, Card>; log: Record<string, number>; newLog: Record<string, number>; settings: Settings };

export const DEFAULT_SETTINGS: Settings = { newPerDay: 10, mode: 'hanzi', autoSpeak: false, writeFirst: true };
export const emptyState = (): State => ({ v: 1, cards: {}, log: {}, newLog: {}, settings: { ...DEFAULT_SETTINGS } });

export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n));
}
export function newCard(today: string): Card { return { ef: 2.5, ivl: 0, reps: 0, due: today, lapses: 0, seen: today }; }

export function schedule(c: Card, g: Grade, today: string): Card {
  let { ef, ivl, reps, lapses } = c;
  if (g === 0) { reps = 0; ivl = 0; lapses++; ef = Math.max(1.3, ef - 0.2); }
  else {
    if (g === 1) { ivl = reps === 0 ? 1 : Math.max(ivl + 1, Math.round(ivl * 1.2)); ef = Math.max(1.3, ef - 0.15); }
    else if (g === 2) { ivl = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(ivl + 1, Math.round(ivl * ef)); }
    else { ivl = reps === 0 ? 4 : Math.max(ivl + 2, Math.round(ivl * ef * 1.3)); ef += 0.15; }
    reps++;
  }
  return { ...c, ef: +ef.toFixed(2), ivl, reps, lapses, due: addDays(today, ivl) };
}
/** label under each grade button: the next interval */
export function preview(c: Card | undefined, g: Grade, today: string): string {
  const n = schedule(c ?? newCard(today), g, today).ivl;
  return n === 0 ? '<1d' : n < 30 ? `${n}d` : n < 365 ? `${Math.round(n / 30)}mo` : `${(n / 365).toFixed(1)}y`;
}
export function dueIds(s: State, today: string): string[] {
  return Object.entries(s.cards).filter(([, c]) => c.due <= today).sort((a, b) => a[1].due.localeCompare(b[1].due)).map(([k]) => k);
}
export function newIds(s: State, order: string[], today: string): string[] {
  const left = Math.max(0, s.settings.newPerDay - (s.newLog[today] ?? 0));
  return order.filter(id => !s.cards[id]).slice(0, left);
}
export function streak(log: Record<string, number>, today: string): number {
  let d = log[today] ? today : addDays(today, -1), n = 0;
  while (log[d]) { n++; d = addDays(d, -1); }
  return n;
}
export function review(s: State, id: string, g: Grade, today: string): State {
  const isNew = !s.cards[id];
  const c = schedule(s.cards[id] ?? newCard(today), g, today);
  return {
    ...s, cards: { ...s.cards, [id]: c },
    log: { ...s.log, [today]: (s.log[today] ?? 0) + 1 },
    newLog: isNew ? { ...s.newLog, [today]: (s.newLog[today] ?? 0) + 1 } : s.newLog,
  };
}
export function validate(x: unknown): State {
  const o = x as State;
  if (!o || typeof o !== 'object' || o.v !== 1 || typeof o.cards !== 'object' || typeof o.log !== 'object') throw new Error('Not a Hanzi Path cards backup');
  return { v: 1, cards: o.cards, log: o.log, newLog: o.newLog ?? {}, settings: { ...DEFAULT_SETTINGS, ...o.settings } };
}

/** Writing result for one card: stroke mistakes, whether the outline/animation was used, whether writing was skipped. */
export type WriteResult = { mistakes: number; helped: boolean; skipped: boolean };
/** Suggested grade from the writing step (the user still chooses). null = no suggestion. */
export function suggestGrade(w: WriteResult | null): Grade | null {
  if (!w) return null;
  if (w.skipped) return w.mistakes > 0 || w.helped ? 0 : null; // gave up mid-way → Again; plain skip → no hint
  if (w.helped) return w.mistakes > 3 ? 0 : 1;
  if (w.mistakes === 0) return 2;
  if (w.mistakes <= 3) return 1;
  return 0;
}

export const STORE_KEY = 'hanzi-path-cards-v1';
export function load(storage: Pick<Storage, 'getItem'> = localStorage): State {
  try { const r = storage.getItem(STORE_KEY); return r ? validate(JSON.parse(r)) : emptyState(); } catch { return emptyState(); }
}
export function save(s: State, storage: Pick<Storage, 'setItem'> = localStorage) { storage.setItem(STORE_KEY, JSON.stringify(s)); }
