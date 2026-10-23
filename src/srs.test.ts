import { describe, it, expect } from 'vitest';
import { schedule, newCard, addDays, streak, review, emptyState, dueIds, newIds, validate, preview, suggestGrade, load, save, DEFAULT_SETTINGS } from './srs';
const T = '2026-10-22';
describe('sm-2', () => {
  it('new card intervals by grade', () => {
    expect(schedule(newCard(T), 0, T).ivl).toBe(0);
    expect(schedule(newCard(T), 1, T).ivl).toBe(1);
    expect(schedule(newCard(T), 2, T).due).toBe('2026-10-23');
    expect(schedule(newCard(T), 3, T).ivl).toBe(4);
  });
  it('good grows 1 → 3 → 8', () => {
    let c = schedule(newCard(T), 2, T); c = schedule(c, 2, T); expect(c.ivl).toBe(3);
    c = schedule(c, 2, T); expect(c.ivl).toBe(8);
  });
  it('again resets and lowers ease with floor', () => {
    let c = schedule(schedule(newCard(T), 2, T), 2, T);
    for (let i = 0; i < 10; i++) c = schedule(c, 0, T);
    expect(c.reps).toBe(0); expect(c.ef).toBe(1.3); expect(c.lapses).toBe(10); expect(c.due).toBe(T);
  });
  it('preview labels', () => { expect(preview(undefined, 0, T)).toBe('<1d'); expect(preview(undefined, 3, T)).toBe('4d'); });
});
describe('days & streak', () => {
  it('addDays crosses months', () => { expect(addDays('2026-10-31', 1)).toBe('2026-11-01'); expect(addDays('2026-03-01', -1)).toBe('2026-02-28'); });
  it('streak counts back from today or yesterday', () => {
    expect(streak({ [T]: 3, '2026-10-21': 1, '2026-10-20': 2, '2026-10-18': 1 }, T)).toBe(3);
    expect(streak({ '2026-10-21': 1 }, T)).toBe(1);
    expect(streak({ '2026-10-20': 1 }, T)).toBe(0);
  });
});
describe('state', () => {
  it('new-per-day limit and due queue', () => {
    let s = emptyState(); s.settings.newPerDay = 3;
    const order = ['a', 'b', 'c', 'd', 'e'];
    expect(newIds(s, order, T)).toEqual(['a', 'b', 'c']);
    s = review(s, 'a', 2, T); s = review(s, 'b', 0, T);
    expect(newIds(s, order, T)).toEqual(['c']);
    expect(dueIds(s, T)).toEqual(['b']);
    expect(dueIds(s, addDays(T, 1)).sort()).toEqual(['a', 'b']);
    expect(s.log[T]).toBe(2);
  });
  it('backup roundtrip + reject junk', () => {
    const s = review(emptyState(), 'x', 2, T);
    expect(validate(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(() => validate({ foo: 1 })).toThrow();
  });
});

describe('write step', () => {
  it('suggests a grade from mistakes', () => {
    expect(suggestGrade({ mistakes: 0, helped: false, skipped: false })).toBe(2);
    expect(suggestGrade({ mistakes: 2, helped: false, skipped: false })).toBe(1);
    expect(suggestGrade({ mistakes: 5, helped: false, skipped: false })).toBe(0);
    expect(suggestGrade({ mistakes: 0, helped: true, skipped: false })).toBe(1);
    expect(suggestGrade({ mistakes: 1, helped: false, skipped: true })).toBe(0);
    expect(suggestGrade({ mistakes: 0, helped: false, skipped: true })).toBeNull();
    expect(suggestGrade(null)).toBeNull();
  });
  it('write-before-grading defaults on, and old backups get it', () => {
    expect(DEFAULT_SETTINGS.writeFirst).toBe(true);
    const old = { v: 1, cards: {}, log: {}, newLog: {}, settings: { newPerDay: 5, mode: 'pinyin', autoSpeak: true } };
    expect(validate(old).settings).toEqual({ newPerDay: 5, mode: 'pinyin', autoSpeak: true, writeFirst: true });
  });
  it('load/save uses its own key and starts fresh (no carry-over from Hanzi Flashcards)', () => {
    const m = new Map<string, string>();
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    m.set('hanzi-flashcards-v1', JSON.stringify(review(emptyState(), 'x', 2, T)));
    expect(load(st)).toEqual(emptyState());
    const s = review(emptyState(), 'y', 3, T); save(s, st);
    expect(load(st)).toEqual(s);
    m.set('hanzi-path-cards-v1', '{bad'); expect(load(st)).toEqual(emptyState());
  });
});
