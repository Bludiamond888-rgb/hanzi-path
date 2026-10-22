export type CharStat = { box: number; due: string; seen: number; mistakes: number; lastMistakes: number };
export type Progress = {
  v: 1; xp: number; streak: number; best: number; lastDay: string | null;
  lessons: Record<string, number>; // lessonId -> best stars (1-3)
  chars: Record<string, CharStat>;
  daily: Record<string, number>; // day -> xp
};
export const LESSON_SIZE = 5;
export const LESSONS_PER_UNIT = 6;
export const INTERVALS = [0, 1, 2, 4, 7, 15, 30]; // days per Leitner box

export const emptyProgress = (): Progress => ({ v: 1, xp: 0, streak: 0, best: 0, lastDay: null, lessons: {}, chars: {}, daily: {} });

export function dayKey(d = new Date()): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}
export function daysBetween(a: string, b: string): number {
  const p = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(b) - p(a)) / 86400000);
}

export function chunkLessons<T>(items: T[], size = LESSON_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  // fold a tiny trailing lesson into the previous one
  if (out.length > 1 && out[out.length - 1].length < 3) { const last = out.pop()!; out[out.length - 1].push(...last); }
  return out;
}
export const lessonId = (i: number) => `L${i + 1}`;
export function isUnlocked(p: Progress, index: number): boolean {
  return index === 0 || (p.lessons[lessonId(index - 1)] ?? 0) > 0;
}
/** stars from quiz mistakes, averaged per character */
export function starsFor(totalMistakes: number, chars: number): number {
  const avg = totalMistakes / Math.max(1, chars);
  return avg <= 1 ? 3 : avg <= 3 ? 2 : 1;
}
export function xpFor(stars: number, chars: number): number { return chars * 10 + stars * 5; }

/** current streak, accounting for missed days (shown streak is 0 if a day was skipped) */
export function currentStreak(p: Progress, today = dayKey()): number {
  if (!p.lastDay) return 0;
  return daysBetween(p.lastDay, today) <= 1 ? p.streak : 0;
}
function touchStreak(p: Progress, today: string): Progress {
  if (p.lastDay === today) return p;
  const gap = p.lastDay ? daysBetween(p.lastDay, today) : Infinity;
  const streak = gap === 1 ? p.streak + 1 : 1;
  return { ...p, streak, best: Math.max(p.best, streak), lastDay: today };
}

/** Leitner update for one character after a from-memory quiz */
export function updateChar(s: CharStat | undefined, mistakes: number, today: string): CharStat {
  const prev = s ?? { box: 0, due: today, seen: 0, mistakes: 0, lastMistakes: 0 };
  let box: number;
  if (mistakes === 0) box = Math.min(prev.box + 1, INTERVALS.length - 1);
  else if (mistakes <= 2) box = Math.max(1, prev.box);           // hold
  else box = 1;                                                 // weak: back to the start
  box = Math.max(1, box);
  return { box, due: addDays(today, INTERVALS[box]), seen: prev.seen + 1, mistakes: prev.mistakes + mistakes, lastMistakes: mistakes };
}

export type Result = { char: string; mistakes: number };
export function recordSession(p: Progress, results: Result[], opts: { lessonIndex?: number; today?: string } = {}): { progress: Progress; stars: number; xp: number } {
  const today = opts.today ?? dayKey();
  const total = results.reduce((a, r) => a + r.mistakes, 0);
  const stars = starsFor(total, results.length);
  const xp = opts.lessonIndex === undefined ? results.length * 5 + stars * 2 : xpFor(stars, results.length);
  let next = touchStreak(p, today);
  const chars = { ...next.chars };
  for (const r of results) chars[r.char] = updateChar(chars[r.char], r.mistakes, today);
  const lessons = { ...next.lessons };
  if (opts.lessonIndex !== undefined) {
    const id = lessonId(opts.lessonIndex);
    lessons[id] = Math.max(lessons[id] ?? 0, stars);
  }
  next = { ...next, chars, lessons, xp: next.xp + xp, daily: { ...next.daily, [today]: (next.daily[today] ?? 0) + xp } };
  return { progress: next, stars, xp };
}

/** characters due for review, weakest first */
export function reviewQueue(p: Progress, today = dayKey(), max = 10): string[] {
  return Object.entries(p.chars)
    .filter(([, s]) => s.due <= today)
    .sort(([, a], [, b]) => a.box - b.box || b.lastMistakes - a.lastMistakes || a.due.localeCompare(b.due))
    .slice(0, max).map(([c]) => c);
}
/** weak = in box 1 (recently missed) */
export const weakChars = (p: Progress) => Object.entries(p.chars).filter(([, s]) => s.box <= 1 && s.lastMistakes > 0).map(([c]) => c);

const KEY = 'hanzi-path-progress-v1';
export function load(storage: Pick<Storage, 'getItem'> = localStorage): Progress {
  try { const raw = storage.getItem(KEY); return raw ? parseBackup(raw) : emptyProgress(); } catch { return emptyProgress(); }
}
export function save(p: Progress, storage: Pick<Storage, 'setItem'> = localStorage) { storage.setItem(KEY, JSON.stringify(p)); }
export function exportBackup(p: Progress): string { return JSON.stringify({ app: 'hanzi-path', exported: new Date().toISOString(), progress: p }, null, 1); }
export function parseBackup(text: string): Progress {
  const o = JSON.parse(text);
  const p = o && o.app === 'hanzi-path' ? o.progress : o;
  if (!p || p.v !== 1 || typeof p.xp !== 'number' || typeof p.lessons !== 'object' || typeof p.chars !== 'object') throw new Error('Not a Hanzi Path backup');
  return { ...emptyProgress(), ...p };
}
