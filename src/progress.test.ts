import { describe, it, expect } from 'vitest';
import * as P from './progress';
import data from './data/hsk1.json';

describe('data', () => {
  it('has 150 words and 178 unique chars with pinyin+meaning', () => {
    expect(data.words.length).toBe(150);
    const set = new Set(data.words.map(w => w.w).join(''));
    expect(data.chars.length).toBe(set.size);
    for (const c of data.chars) { expect(c.p).toMatch(/^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+$/); expect(c.m.length).toBeGreaterThan(1); expect(c.ex).toContain(c.c); }
  });
});
describe('lessons', () => {
  it('chunks into ~5 and folds tiny tail', () => {
    expect(P.chunkLessons([1,2,3,4,5,6,7]).map(l=>l.length)).toEqual([7]);
    expect(P.chunkLessons(Array.from({length:178})).every(l=>l.length>=3 && l.length<=7)).toBe(true);
  });
  it('unlocks in order', () => {
    let p = P.emptyProgress();
    expect(P.isUnlocked(p,0)).toBe(true); expect(P.isUnlocked(p,1)).toBe(false);
    p = P.recordSession(p,[{char:'一',mistakes:0}],{lessonIndex:0,today:'2026-10-01'}).progress;
    expect(P.isUnlocked(p,1)).toBe(true); expect(P.isUnlocked(p,2)).toBe(false);
  });
  it('stars by mistakes', () => {
    expect(P.starsFor(0,5)).toBe(3); expect(P.starsFor(5,5)).toBe(3); expect(P.starsFor(10,5)).toBe(2); expect(P.starsFor(30,5)).toBe(1);
  });
  it('keeps best stars and adds xp', () => {
    let r = P.recordSession(P.emptyProgress(),[{char:'一',mistakes:9}],{lessonIndex:0,today:'2026-10-01'});
    expect(r.stars).toBe(1); const xp1 = r.progress.xp;
    r = P.recordSession(r.progress,[{char:'一',mistakes:0}],{lessonIndex:0,today:'2026-10-01'});
    expect(r.progress.lessons.L1).toBe(3); expect(r.progress.xp).toBeGreaterThan(xp1);
    r = P.recordSession(r.progress,[{char:'一',mistakes:9}],{lessonIndex:0,today:'2026-10-01'});
    expect(r.progress.lessons.L1).toBe(3);
  });
});
describe('streak', () => {
  it('counts consecutive days and resets after gap', () => {
    let p = P.emptyProgress();
    const go = (d:string) => { p = P.recordSession(p,[{char:'一',mistakes:0}],{today:d}).progress; };
    go('2026-10-30'); go('2026-10-30'); expect(p.streak).toBe(1);
    go('2026-10-31'); go('2026-11-01'); expect(p.streak).toBe(3);
    expect(P.currentStreak(p,'2026-11-02')).toBe(3); expect(P.currentStreak(p,'2026-11-03')).toBe(0);
    go('2026-11-05'); expect(p.streak).toBe(1); expect(p.best).toBe(3);
  });
});
describe('SRS', () => {
  it('promotes on clean, demotes weak, schedules', () => {
    let s = P.updateChar(undefined,0,'2026-10-01'); expect(s.box).toBe(1); expect(s.due).toBe('2026-10-02');
    s = P.updateChar(s,0,'2026-10-02'); expect(s.box).toBe(2); expect(s.due).toBe('2026-10-04');
    s = P.updateChar(s,1,'2026-10-04'); expect(s.box).toBe(2);
    s = P.updateChar(s,4,'2026-10-04'); expect(s.box).toBe(1);
    for (let i=0;i<20;i++) s = P.updateChar(s,0,'2026-10-04'); expect(s.box).toBe(6);
  });
  it('queues due chars weakest first', () => {
    let p = P.recordSession(P.emptyProgress(),[{char:'一',mistakes:0},{char:'二',mistakes:5},{char:'三',mistakes:1}],{today:'2026-10-01'}).progress;
    expect(P.reviewQueue(p,'2026-10-01')).toEqual([]);
    expect(P.reviewQueue(p,'2026-10-02')).toEqual(['二','三','一']);
    expect(P.weakChars(p)).toContain('二');
  });
});
describe('backup', () => {
  it('round-trips and rejects junk', () => {
    const p = P.recordSession(P.emptyProgress(),[{char:'一',mistakes:0}],{lessonIndex:0}).progress;
    expect(P.parseBackup(P.exportBackup(p))).toEqual(p);
    expect(()=>P.parseBackup('{"a":1}')).toThrow();
    const mem:Record<string,string> = {}; const st = {getItem:(k:string)=>mem[k]??null,setItem:(k:string,v:string)=>{mem[k]=v}};
    P.save(p,st); expect(P.load(st)).toEqual(p);
  });
});
