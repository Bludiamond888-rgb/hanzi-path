import { useEffect, useMemo, useRef, useState } from 'react';
import Writer, { type Mode as PadMode } from './Writer';
import { BY_CHAR, CHARS, ORDER, matches, plain, short, type Char } from './data';
import { canSpeak, speak } from './speak';
import * as S from './srs';

// Cards tab: SM-2 flashcards (ported from the standalone Hanzi Flashcards app) with a
// stroke-checked writing step before grading. State lives in localStorage under S.STORE_KEY.

type Sub = 'study' | 'deck' | 'stats' | 'settings';
const SUBS: [Sub, string, string][] = [['study', '习', 'Study'], ['deck', '字', 'Deck'], ['stats', '绩', 'Progress'], ['settings', '设', 'Settings']];
const GRADES: [S.Grade, string, string][] = [[0, 'Again', 'again'], [1, 'Hard', 'hard'], [2, 'Good', 'good'], [3, 'Easy', 'easy']];
const MODES: [S.Mode, string][] = [['hanzi', '字 → meaning'], ['meaning', 'meaning → 字'], ['pinyin', 'pīnyīn → 字'], ['mixed', 'Mixed']];

export function cardsBadge(st: S.State, today: string) { return S.dueIds(st, today).length + S.newIds(st, ORDER, today).length; }

function usePadSize() {
  const calc = () => Math.round(Math.min(340, window.innerWidth - 48, Math.max(220, window.innerHeight - 560)));
  const [s, setS] = useState(calc);
  useEffect(() => { const f = () => setS(calc()); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return s;
}

export default function Cards({ st, setSt, today }: { st: S.State; setSt: (s: S.State) => void; today: string }) {
  const [sub, setSub] = useState<Sub>('study');
  const [inSession, setInSession] = useState(false);
  const go = (s: Sub) => { setSub(s); window.scrollTo(0, 0); };
  return (
    <main className="fc">
      {!inSession && (
        <div className="fc-seg" role="tablist">
          {SUBS.map(([k, z, l]) => <button key={k} role="tab" className={sub === k ? 'on' : ''} onClick={() => go(k)} data-testid={'fc-' + k}><i>{z}</i>{l}</button>)}
        </div>
      )}
      {sub === 'study' && <Study st={st} setSt={setSt} today={today} onSession={setInSession} />}
      {sub === 'deck' && <Deck st={st} today={today} />}
      {sub === 'stats' && <Stats st={st} today={today} />}
      {sub === 'settings' && <Settings st={st} setSt={setSt} />}
    </main>
  );
}

function modeFor(m: S.Mode, id: string, n: number): Exclude<S.Mode, 'mixed'> {
  if (m !== 'mixed') return m;
  return (['hanzi', 'meaning', 'pinyin'] as const)[(id.charCodeAt(0) + n) % 3];
}

/** 'front' = prompt only · 'write' = writing pad · 'back' = answer + grades */
type Phase = 'front' | 'write' | 'back';

function Study({ st, setSt, today, onSession }: { st: S.State; setSt: (s: S.State) => void; today: string; onSession: (b: boolean) => void }) {
  const [queue, setQueue] = useState<string[] | null>(null);
  const [phase, setPhase] = useState<Phase>('front');
  const [written, setWritten] = useState<S.WriteResult | null>(null);
  const [done, setDone] = useState(0);
  const due = S.dueIds(st, today), fresh = S.newIds(st, ORDER, today);
  const id = queue?.[0];
  const ch = id ? BY_CHAR[id] : undefined;
  const mode = id ? modeFor(st.settings.mode, id, st.cards[id]?.reps ?? 0) : 'hanzi';
  const write = st.settings.writeFirst;
  const firstPhase = (m: typeof mode): Phase => write && m !== 'hanzi' ? 'write' : 'front';
  useEffect(() => { onSession(!!ch); }, [!!ch]); // eslint-disable-line
  useEffect(() => () => onSession(false), []); // eslint-disable-line
  // auto-play: on the prompt for pinyin cards, on the answer for the others
  const answerShown = phase === 'back' || (phase === 'write' && mode === 'hanzi');
  useEffect(() => { if (ch && st.settings.autoSpeak && (answerShown ? mode !== 'pinyin' : mode === 'pinyin')) speak(ch.c); }, [id, done, answerShown]); // eslint-disable-line

  const begin = (q: string[], s: S.State) => {
    setQueue(q); setWritten(null);
    setPhase(q[0] ? firstPhase(modeFor(s.settings.mode, q[0], s.cards[q[0]]?.reps ?? 0)) : 'front');
    window.scrollTo(0, 0);
  };
  const start = () => { begin([...due, ...fresh], st); setDone(0); };
  const reveal = () => setPhase(write ? 'write' : 'back');
  const wrote = (r: S.WriteResult) => { setWritten(r); setPhase('back'); window.scrollTo(0, 0); };
  const grade = (g: S.Grade) => {
    if (!id || !queue) return;
    const ns = S.review(st, id, g, today);
    setSt(ns);
    const rest = queue.slice(1);
    if (g === 0) rest.splice(Math.min(3, rest.length), 0, id);
    begin(rest, ns); setDone(d => d + 1);
  };

  if (!queue || !ch) {
    const finished = queue && !ch;
    return (
      <section className="fc-pad">
        <div className="fc-hero card">
          <div className="fc-hero-k">{finished ? '今日毕' : '今日'}</div>
          <h1>{finished ? 'All done for today' : due.length + fresh.length ? 'Ready to review' : 'Nothing due'}</h1>
          <div className="fc-trio">
            <div><b data-testid="due-count">{due.length}</b><small>Due</small></div>
            <div><b>{fresh.length}</b><small>New</small></div>
            <div><b>{st.log[today] ?? 0}</b><small>Reviewed</small></div>
          </div>
          {due.length + fresh.length > 0
            ? <button className="btn fc-big" onClick={start} data-testid="start">{finished ? 'Keep going' : 'Begin review'}</button>
            : <p className="fine">{finished ? `${done} cards reviewed. Come back tomorrow.` : 'Raise new cards per day in Settings to learn more today.'}</p>}
        </div>
        <p className="fine">{MODES.find(m => m[0] === st.settings.mode)![1]} · {st.settings.newPerDay} new / day · {write ? '写 write before grading' : 'no writing step'}</p>
        {due.length + fresh.length > 0 && (
          <div className="fc-upnext"><h3>Up next</h3><div className="fc-chips">{[...due, ...fresh].slice(0, 10).map(i => <span key={i} className="fc-chip">{i}</span>)}</div></div>
        )}
      </section>
    );
  }

  const total = done + queue.length;
  const sp = canSpeak && <button className="fc-say" onClick={e => { e.stopPropagation(); speak(ch.c); }} aria-label="Play pronunciation" data-testid="say">♪</button>;
  const tag = !st.cards[id!] ? <em className="new">新 New</em> : <em>{st.cards[id!].reps ? 'Review' : 'Relearn'}</em>;
  const sug = phase === 'back' ? S.suggestGrade(written) : null;
  return (
    <section className="fc-pad fc-session">
      <div className="fc-prog">
        <button className="x" onClick={() => setQueue(null)} aria-label="End session">✕</button>
        <div className="bar big"><i style={{ width: `${(done / total) * 100}%` }} /></div>
        <span className="count">{queue.length} left</span>
      </div>

      {phase === 'write' ? (
        <>
          <div className="fc-mini card" data-testid="prompt">
            <div className="fc-corner">{tag}</div>
            {mode === 'hanzi' ? (
              <div className="fc-mini-row"><span className="fc-mini-han">{ch.c}</span><span><span className="fc-py">{ch.p}{sp}</span><span className="fc-mean">{short(ch.m)}</span></span></div>
            ) : mode === 'meaning' ? <div className="fc-prompt-m">{short(ch.m)}</div> : <div className="fc-prompt-p">{ch.p}{sp}</div>}
          </div>
          <h2 className="fc-ask">{mode === 'hanzi' ? 'Now write it' : 'Write the character'}</h2>
          <WritePad key={id + ':' + done} char={ch} copy={mode === 'hanzi'} onDone={wrote} />
        </>
      ) : (
        <div className={'fc-flash card' + (phase === 'back' ? ' shown' : '')} data-testid="flash" onClick={() => phase === 'front' && reveal()}>
          <div className="fc-corner">{tag}</div>
          {mode === 'hanzi' && <div className="fc-big-han">{ch.c}</div>}
          {mode === 'meaning' && <div className="fc-prompt-m">{short(ch.m)}</div>}
          {mode === 'pinyin' && <div className="fc-prompt-p">{ch.p}{sp}</div>}
          {phase === 'front' && <div className="fc-hint">{mode === 'hanzi' ? 'Recall the pīnyīn and meaning' : 'Recall the character'}</div>}
          {phase === 'back' && (
            <div className="fc-answer" data-testid="answer">
              <div className="fc-rule" />
              {mode !== 'hanzi' && <div className="fc-big-han sm">{ch.c}</div>}
              <div className="fc-py">{ch.p}{mode !== 'pinyin' && sp}</div>
              {mode !== 'meaning' && <div className="fc-mean">{short(ch.m)}</div>}
              {ch.ex !== ch.c && <div className="fc-ex"><b>{[...ch.ex].map((x, i) => <span key={i} className={x === ch.c ? 'hl' : ''}>{x}</span>)}</b><span>{ch.exp}</span><small>{short(ch.exm)}</small></div>}
              {written && <WriteSummary w={written} />}
            </div>
          )}
        </div>
      )}

      {phase === 'front' && <button className="btn fc-big" onClick={reveal} data-testid="show">Show answer</button>}
      {phase === 'back' && (
        <div className="fc-grades" data-testid="grades">
          {GRADES.map(([g, l, c]) => (
            <button key={g} className={'fc-grade ' + c + (sug === g ? ' sug' : '')} onClick={() => grade(g)} data-testid={'grade-' + c}>
              {sug === g && <span className="fc-sug" data-testid="suggested">荐 suggested</span>}
              <b>{l}</b><small>{S.preview(st.cards[id!], g, today)}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function WriteSummary({ w }: { w: S.WriteResult }) {
  const [z, text] = w.skipped
    ? (w.mistakes || w.helped ? ['弃', `Gave up${w.mistakes ? ` after ${w.mistakes} mistake${w.mistakes > 1 ? 's' : ''}` : ''}`] : ['略', 'Writing skipped'])
    : w.mistakes === 0 && !w.helped ? ['优', 'Written · no mistakes']
      : ['写', `Written · ${w.mistakes} mistake${w.mistakes === 1 ? '' : 's'}${w.helped ? ' · used stroke help' : ''}`];
  return <div className={'fc-wsum' + (w.skipped ? ' skip' : '')} data-testid="write-summary"><i>{z}</i>{text}</div>;
}

/** Stroke-checked writing pad built on Hanzi Path's Writer (hanzi-writer quiz). */
function WritePad({ char, copy, onDone }: { char: Char; copy: boolean; onDone: (r: S.WriteResult) => void }) {
  const size = usePadSize();
  const [pad, setPad] = useState<PadMode>('quiz');
  const [miss, setMiss] = useState(0);
  const [helped, setHelped] = useState(false);
  const [restart, setRestart] = useState(0);
  const base = useRef(0); // mistakes carried over from before "Show strokes" / restart
  const total = base.current + miss;
  const finish = (m: number) => {
    if (pad === 'watch') { setPad('trace'); return; }
    const mistakes = base.current + m;
    setTimeout(() => onDone({ mistakes, helped, skipped: false }), 450); // let the completed character flash first
  };
  const showStrokes = () => { base.current += miss; setMiss(0); setHelped(true); setPad('watch'); setRestart(r => r + 1); };
  const again = () => { base.current += miss; setMiss(0); setPad(helped ? 'trace' : 'quiz'); setRestart(r => r + 1); };
  const hint = pad === 'quiz' && miss >= 3;
  return (
    <div className="fc-write" data-testid="write-pad" data-char={char.c}>
      <Writer char={char.c} mode={pad} size={size} replayKey={restart} onDone={finish} onMistake={setMiss} />
      <div className="stage-note">
        {pad === 'watch' ? 'Watch the stroke order…'
          : total ? <span className="miss" data-testid="pad-miss">{total} mistake{total > 1 ? 's' : ''}{hint ? ' · hint shown' : ''}</span>
          : pad === 'trace' ? 'Trace over the outline' : copy ? 'Copy it from the card above' : `From memory · ${char.n} stroke${char.n > 1 ? 's' : ''}`}
      </div>
      <div className="row fc-pad-actions">
        <button className="btn ghost small" onClick={again}>↻ Restart</button>
        <button className="btn ghost small" disabled={pad !== 'quiz'} onClick={showStrokes} data-testid="show-strokes">Show strokes</button>
      </div>
      <button className="link fc-skip" onClick={() => onDone({ mistakes: total, helped, skipped: true })} data-testid="skip-writing">Skip writing</button>
    </div>
  );
}

function status(st: S.State, id: string, today: string): ['new' | 'due' | 'learning' | 'known', string] {
  const c = st.cards[id];
  if (!c) return ['new', 'New'];
  if (c.due <= today) return ['due', 'Due'];
  if (c.ivl >= 21) return ['known', `${c.ivl}d`];
  return ['learning', `in ${Math.round((Date.parse(c.due) - Date.parse(today)) / 864e5)}d`];
}

function Deck({ st, today }: { st: S.State; today: string }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState<'all' | 'new' | 'due' | 'learning' | 'known'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => {
    const t = plain(q.trim()).replace(/\s/g, '');
    const rank = (c: Char) => !t ? 0 : c.c === q.trim() ? -2 : plain(c.p).replace(/\s/g, '').startsWith(t) ? -1 : 0;
    return CHARS.filter(c => matches(c, q) && (f === 'all' || status(st, c.c, today)[0] === f)).sort((a, b) => rank(a) - rank(b));
  }, [q, f, st, today]);
  return (
    <section className="fc-pad">
      <input className="fc-search" placeholder="Search 字, pinyin (ni / nǐ) or meaning" value={q} onChange={e => setQ(e.target.value)} data-testid="search" type="search" />
      <div className="fc-filter">{(['all', 'new', 'due', 'learning', 'known'] as const).map(k => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{k === 'known' ? 'Mature' : k[0].toUpperCase() + k.slice(1)}</button>)}</div>
      <p className="fine fc-left">{list.length} of {CHARS.length} characters</p>
      <ul className="fc-deck">
        {list.map(c => { const [k, l] = status(st, c.c, today); return (
          <li key={c.c}>
            <button className="fc-row" onClick={() => setOpen(open === c.c ? null : c.c)}>
              <span className="fc-tile">{c.c}</span>
              <span className="fc-meta"><b>{c.p}</b><small>{short(c.m)}</small></span>
              <span className={'fc-st ' + k}>{l}</span>
            </button>
            {open === c.c && (
              <div className="fc-detail">
                {short(c.m) !== c.m && <p>{c.m}</p>}
                {c.ex !== c.c && <p><b>{c.ex}</b> {c.exp} — {short(c.exm)}</p>}
                <div className="row">{canSpeak && <button className="btn ghost small" onClick={() => speak(c.ex !== c.c ? `${c.c}，${c.ex}` : c.c)}>♪ Listen</button>}<span className="fine">{c.n} strokes</span></div>
              </div>
            )}
          </li>); })}
      </ul>
    </section>
  );
}

function Stats({ st, today }: { st: S.State; today: string }) {
  const cards = Object.values(st.cards);
  const learned = cards.filter(c => c.reps > 0).length, mature = cards.filter(c => c.ivl >= 21).length;
  const due = S.dueIds(st, today).length, strk = S.streak(st.log, today);
  const total = Object.values(st.log).reduce((a, b) => a + b, 0);
  const weeks = 15, [yy, mm, dd] = today.split('-').map(Number), dow = (new Date(yy, mm - 1, dd).getDay() + 6) % 7;
  const start = S.addDays(today, -(weeks - 1) * 7 - dow);
  const days = Array.from({ length: weeks * 7 }, (_, i) => S.addDays(start, i));
  const max = Math.max(1, ...days.map(d => st.log[d] ?? 0));
  const tomorrow = cards.filter(c => c.due === S.addDays(today, 1)).length;
  const N = CHARS.length;
  return (
    <section className="fc-pad">
      <div className="fc-grid4">
        <Stat k="Due today" v={due} z="今" /><Stat k="Learned" v={learned} z="学" sub={`of ${N}`} />
        <Stat k="Day streak" v={strk} z="日" red /><Stat k="Mature" v={mature} z="熟" sub="21d+" />
      </div>
      <div className="card">
        <h3 className="fc-h3">Deck</h3>
        <div className="fc-stack"><i className="k" style={{ width: `${mature / N * 100}%` }} /><i className="l" style={{ width: `${(learned - mature) / N * 100}%` }} /></div>
        <div className="fc-legend"><span><i className="k" />Mature {mature}</span><span><i className="l" />Learning {learned - mature}</span><span><i />Unseen {N - cards.length}</span></div>
      </div>
      <div className="card">
        <h3 className="fc-h3">Reviews <small>{total} total · {st.log[today] ?? 0} today · {tomorrow} due tomorrow</small></h3>
        <div className="fc-heat" data-testid="heat">{days.map(d => { const n = st.log[d] ?? 0; return <i key={d} title={`${d}: ${n}`} className={d === today ? 'today' : ''} style={{ opacity: d > today ? 0 : 1, background: n ? `rgba(27,26,23,${0.25 + 0.75 * n / max})` : undefined }} />; })}</div>
      </div>
    </section>
  );
}
const Stat = ({ k, v, z, sub, red }: { k: string; v: number; z: string; sub?: string; red?: boolean }) =>
  <div className={'fc-stat card' + (red ? ' red' : '')}><span className="z">{z}</span><b>{v}</b><small>{k}{sub && <em> {sub}</em>}</small></div>;

function Settings({ st, setSt }: { st: S.State; setSt: (s: S.State) => void }) {
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const set = (p: Partial<S.Settings>) => setSt({ ...st, settings: { ...st.settings, ...p } });
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(st, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hanzi-path-cards-${S.dayKey()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); setMsg('Backup saved.');
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    try { const s = S.validate(JSON.parse(await f.text())); if (confirm(`Replace current card progress with this backup (${Object.keys(s.cards).length} cards)?`)) { setSt(s); setMsg('Backup restored.'); } }
    catch (e) { setMsg((e as Error).message || 'Could not read that file.'); }
    if (file.current) file.current.value = '';
  };
  return (
    <section className="fc-pad">
      <div className="card">
        <h3 className="fc-h3">Writing</h3>
        <label className="fc-toggle"><span>Write before grading</span><input type="checkbox" checked={st.settings.writeFirst} onChange={e => set({ writeFirst: e.target.checked })} data-testid="write-first" /></label>
        <p className="fine fc-left">Write each character on the pad (strokes are checked, hint after 3 misses) before the Again / Hard / Good / Easy buttons appear. A grade is suggested from your mistakes; you still choose.</p>
      </div>
      <div className="card">
        <h3 className="fc-h3">New cards per day</h3>
        <div className="fc-stepper"><button onClick={() => set({ newPerDay: Math.max(0, st.settings.newPerDay - 5) })} aria-label="Fewer">−</button><b data-testid="npd">{st.settings.newPerDay}</b><button onClick={() => set({ newPerDay: Math.min(50, st.settings.newPerDay + 5) })} aria-label="More">+</button></div>
        <p className="fine fc-left">{CHARS.length} characters ÷ {st.settings.newPerDay || '—'} a day ≈ {st.settings.newPerDay ? Math.ceil(CHARS.length / st.settings.newPerDay) : '∞'} days to see them all.</p>
      </div>
      <div className="card">
        <h3 className="fc-h3">Card direction</h3>
        <div className="fc-modes">{MODES.map(([m, l]) => <button key={m} className={st.settings.mode === m ? 'on' : ''} onClick={() => set({ mode: m })}>{l}</button>)}</div>
      </div>
      <div className="card">
        <h3 className="fc-h3">Pronunciation</h3>
        <label className="fc-toggle"><span>Play audio automatically</span><input type="checkbox" checked={st.settings.autoSpeak} disabled={!canSpeak} onChange={e => set({ autoSpeak: e.target.checked })} /></label>
        <p className="fine fc-left">{canSpeak ? 'Uses your device’s Chinese (zh-CN) voice. On iPhone, add one in Settings › Accessibility › Spoken Content › Voices if it sounds wrong.' : 'Speech is not available in this browser.'}</p>
      </div>
      <div className="card">
        <h3 className="fc-h3">Card backup</h3>
        <p className="fine fc-left">Card progress lives only on this device (separate from the lesson backup under More). Scheduling uses SM-2.</p>
        <div className="row"><button className="btn small" onClick={exportJson}>⬇ Save backup</button><button className="btn ghost small" onClick={() => file.current?.click()}>⬆ Restore…</button></div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => importJson(e.target.files?.[0])} />
        {msg && <p className="ok">{msg}</p>}
        <button className="link danger" onClick={() => { if (confirm('Erase all card progress on this device?')) { setSt({ ...S.emptyState(), settings: st.settings }); setMsg('Card progress reset.'); } }}>Reset card progress</button>
      </div>
    </section>
  );
}
