/** Local progress for the Components (偏旁) feature. Separate key from Path/Review/Cards. */
export type PartStat = { seen: number; quizOk: number; writeOk: number; last: string | null };
export type PartsProgress = { v: 1; parts: Record<string, PartStat> };

export const emptyParts = (): PartsProgress => ({ v: 1, parts: {} });
export const STORE_KEY = 'hanzi-path-components-v1';

export function load(storage: Pick<Storage, 'getItem'> = localStorage): PartsProgress {
  try {
    const raw = storage.getItem(STORE_KEY);
    if (!raw) return emptyParts();
    const o = JSON.parse(raw);
    if (!o || o.v !== 1 || typeof o.parts !== 'object') return emptyParts();
    return { v: 1, parts: o.parts ?? {} };
  } catch { return emptyParts(); }
}
export function save(p: PartsProgress, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(STORE_KEY, JSON.stringify(p));
}

function touch(s: PartStat | undefined, today: string): PartStat {
  return { seen: (s?.seen ?? 0) + 1, quizOk: s?.quizOk ?? 0, writeOk: s?.writeOk ?? 0, last: today };
}
export function markSeen(p: PartsProgress, id: string, today: string): PartsProgress {
  return { ...p, parts: { ...p.parts, [id]: touch(p.parts[id], today) } };
}
export function markQuiz(p: PartsProgress, id: string, ok: boolean, today: string): PartsProgress {
  const prev = touch(p.parts[id], today);
  return { ...p, parts: { ...p.parts, [id]: { ...prev, quizOk: prev.quizOk + (ok ? 1 : 0) } } };
}
export function markWrite(p: PartsProgress, id: string, ok: boolean, today: string): PartsProgress {
  const prev = touch(p.parts[id], today);
  return { ...p, parts: { ...p.parts, [id]: { ...prev, writeOk: prev.writeOk + (ok ? 1 : 0) } } };
}
/** Learned = got at least one quiz and one write correct */
export function isLearned(s: PartStat | undefined): boolean {
  return !!s && s.quizOk > 0 && s.writeOk > 0;
}
export function learnedCount(p: PartsProgress): number {
  return Object.values(p.parts).filter(isLearned).length;
}
