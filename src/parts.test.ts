import { describe, it, expect } from 'vitest';
import * as Parts from './parts';
import components from './data/components.json';

describe('components data', () => {
  it('has a polished HSK-1 starter set with examples', () => {
    expect(components.length).toBeGreaterThanOrEqual(12);
    expect(components.length).toBeLessThanOrEqual(20);
    const ids = new Set<string>();
    for (const c of components) {
      expect(c.id).toMatch(/^[a-z]+$/);
      expect(ids.has(c.id)).toBe(false); ids.add(c.id);
      expect(c.form.length).toBeGreaterThan(0);
      expect(c.pinyin.length).toBeGreaterThan(0);
      expect(c.meaning.length).toBeGreaterThan(1);
      expect(c.tip.length).toBeGreaterThan(10);
      expect(c.examples.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('parts progress', () => {
  it('starts empty and persists under its own key', () => {
    const mem: Record<string, string> = {};
    const storage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
    expect(Parts.load(storage)).toEqual(Parts.emptyParts());
    let p = Parts.markQuiz(Parts.emptyParts(), 'ren', true, '2026-10-26');
    p = Parts.markWrite(p, 'ren', true, '2026-10-26');
    Parts.save(p, storage);
    expect(mem[Parts.STORE_KEY]).toBeTruthy();
    expect(mem['hanzi-path-progress-v1']).toBeUndefined();
    const loaded = Parts.load(storage);
    expect(Parts.isLearned(loaded.parts.ren)).toBe(true);
    expect(Parts.learnedCount(loaded)).toBe(1);
  });
  it('needs both quiz and write to count as learned', () => {
    let p = Parts.markQuiz(Parts.emptyParts(), 'kou', true, '2026-10-26');
    expect(Parts.isLearned(p.parts.kou)).toBe(false);
    p = Parts.markWrite(p, 'kou', false, '2026-10-26');
    expect(Parts.isLearned(p.parts.kou)).toBe(false);
    p = Parts.markWrite(p, 'kou', true, '2026-10-26');
    expect(Parts.isLearned(p.parts.kou)).toBe(true);
  });
});
