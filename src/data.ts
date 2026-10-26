import raw from './data/hsk1.json';
import strokes from './data/strokes.json';
import componentStrokes from './data/component-strokes.json';
import { chunkLessons, LESSONS_PER_UNIT } from './progress';
export type Char = { c: string; p: string; m: string; ex: string; exp: string; exm: string; n: number };
export const CHARS: Char[] = raw.chars as Char[];
export const WORDS = raw.words;
export const BY_CHAR: Record<string, Char> = Object.fromEntries(CHARS.map(c => [c.c, c]));
export const LESSONS: Char[][] = chunkLessons(CHARS);
export const UNITS = chunkLessons(LESSONS.map((_, i) => i), LESSONS_PER_UNIT);
export const STROKES = { ...(strokes as Record<string, unknown>), ...(componentStrokes as Record<string, unknown>) };
export const CHAPTERS: [string, string, string][] = [
  ['第一章', '初笔', 'First strokes'], ['第二章', '日常', 'Everyday words'], ['第三章', '人与家', 'People & home'],
  ['第四章', '时光', 'Time & days'], ['第五章', '行路', 'On the road'], ['第六章', '学而时习', 'Study & practice'],
  ['第七章', '远方', 'Far places'],
];
export const ORDER = CHARS.map(c => c.c);
/** strip tone marks so "ni" finds "nǐ" */
export const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function matches(ch: Char, q: string) {
  const t = plain(q.trim()); if (!t) return true;
  return ch.c.includes(q.trim()) || plain(ch.p).replace(/\s/g, '').includes(t.replace(/\s/g, '')) || ch.m.toLowerCase().includes(t);
}
export const short = (m: string) => m.split(/;\s*/).slice(0, 2).join('; ').replace(/\s*\(CL:[^)]*\)/g, '');
