import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import Writer, { type Mode } from './Writer';
import { BY_CHAR, CHARS, LESSONS, UNITS, UNIT_COLORS, WORDS, type Char } from './data';
import * as P from './progress';
import { canSpeak, speak } from './speak';

type Screen =
  | { k: 'map' } | { k: 'about' } | { k: 'chars' }
  | { k: 'lesson'; index: number } | { k: 'review'; chars: string[] }
  | { k: 'done'; stars: number; xp: number; title: string; mistakes: number; count: number; next?: number };

function useSize() {
  const calc = () => Math.min(320, window.innerWidth - 56, Math.max(220, window.innerHeight - 430));
  const [s, setS] = useState(calc);
  useEffect(() => { const f = () => setS(calc()); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return Math.round(s);
}

const Stars = ({ n, big }: { n: number; big?: boolean }) => (
  <span className={big ? 'stars big' : 'stars'} aria-label={`${n} stars`}>
    {[1, 2, 3].map(i => <span key={i} className={i <= n ? 'on' : ''} style={{ animationDelay: `${i * 0.18}s` }}>★</span>)}
  </span>
);

export default function App() {
  const [prog, setProg] = useState<P.Progress>(() => P.load());
  const [screen, setScreen] = useState<Screen>({ k: 'map' });
  useEffect(() => P.save(prog), [prog]);
  const today = P.dayKey();
  const streak = P.currentStreak(prog, today);
  const due = P.reviewQueue(prog, today);
  const weak = P.weakChars(prog);

  const finish = (results: P.Result[], lessonIndex?: number) => {
    const r = P.recordSession(prog, results, { lessonIndex });
    setProg(r.progress);
    const mistakes = results.reduce((a, b) => a + b.mistakes, 0);
    setScreen({ k: 'done', stars: r.stars, xp: r.xp, mistakes, count: results.length,
      title: lessonIndex === undefined ? 'Review complete!' : `Lesson ${lessonIndex + 1} complete!`,
      next: lessonIndex !== undefined && lessonIndex + 1 < LESSONS.length ? lessonIndex + 1 : undefined });
  };

  return (
    <div className="app">
      {(screen.k === 'map' || screen.k === 'about' || screen.k === 'chars') && (
        <header className="top">
          <div className="brand"><span className="logo">汉</span><div><b>Hanzi Path</b><small>汉字路 · HSK 1</small></div></div>
          <div className="pills">
            <span className={'pill streak' + (streak ? ' lit' : '')} title="Daily streak">🔥 {streak}</span>
            <span className="pill xp" title="Total XP">⚡ {prog.xp}</span>
          </div>
        </header>
      )}
      {screen.k === 'map' && <MapScreen prog={prog} due={due} weak={weak} go={setScreen} />}
      {screen.k === 'chars' && <CharsScreen prog={prog} />}
      {screen.k === 'about' && <About prog={prog} setProg={setProg} />}
      {screen.k === 'lesson' && <Lesson key={'l' + screen.index} chars={LESSONS[screen.index]} title={`Lesson ${screen.index + 1}`} onQuit={() => setScreen({ k: 'map' })} onFinish={r => finish(r, screen.index)} />}
      {screen.k === 'review' && <Lesson key={'r' + screen.chars.join('')} review chars={screen.chars.map(c => BY_CHAR[c])} title="Review" onQuit={() => setScreen({ k: 'map' })} onFinish={r => finish(r)} />}
      {screen.k === 'done' && <Done s={screen} streak={P.currentStreak(prog, today)} go={setScreen} />}
      {(screen.k === 'map' || screen.k === 'about' || screen.k === 'chars') && (
        <nav className="tabs">
          <button className={screen.k === 'map' ? 'on' : ''} onClick={() => setScreen({ k: 'map' })}><span>🗺️</span>Path</button>
          <button disabled={!due.length && !weak.length} onClick={() => setScreen({ k: 'review', chars: due.length ? due : weak.slice(0, 10) })}><span>🔁</span>Review{due.length ? <i className="badge">{due.length}</i> : null}</button>
          <button className={screen.k === 'chars' ? 'on' : ''} onClick={() => setScreen({ k: 'chars' })}><span>字</span>Chars</button>
          <button className={screen.k === 'about' ? 'on' : ''} onClick={() => setScreen({ k: 'about' })}><span>⚙️</span>More</button>
        </nav>
      )}
    </div>
  );
}

function MapScreen({ prog, due, weak, go }: { prog: P.Progress; due: string[]; weak: string[]; go: (s: Screen) => void }) {
  const current = LESSONS.findIndex((_, i) => P.isUnlocked(prog, i) && !prog.lessons[P.lessonId(i)]);
  const curRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { curRef.current?.scrollIntoView({ block: 'center' }); }, []);
  const done = Object.keys(prog.lessons).length;
  const offsets = [0, 42, 64, 42, 0, -42, -64, -42];
  return (
    <main className="map">
      <div className="today card">
        <div><b>{done}/{LESSONS.length}</b> lessons · <b>{Object.keys(prog.chars).length}</b>/{CHARS.length} characters</div>
        <div className="bar"><i style={{ width: `${(done / LESSONS.length) * 100}%` }} /></div>
        {(due.length > 0 || weak.length > 0) && (
          <button className="btn small review" onClick={() => go({ k: 'review', chars: due.length ? due : weak.slice(0, 10) })}>
            🔁 Review {due.length || Math.min(10, weak.length)} {due.length ? 'due' : 'weak'} character{(due.length || weak.length) === 1 ? '' : 's'}
          </button>
        )}
      </div>
      {UNITS.map((lessonIdx, u) => {
        const color = UNIT_COLORS[u % UNIT_COLORS.length];
        const first = LESSONS[lessonIdx[0]][0].c, last = LESSONS[lessonIdx[lessonIdx.length - 1]].slice(-1)[0].c;
        return (
          <section key={u} className="unit">
            <div className="unit-head" style={{ background: color }}>
              <small>UNIT {u + 1}</small>
              <b>{first} … {last}</b>
              <span>{lessonIdx.reduce((a, i) => a + LESSONS[i].length, 0)} characters</span>
            </div>
            <div className="path">
              {lessonIdx.map((i, k) => {
                const open = P.isUnlocked(prog, i), stars = prog.lessons[P.lessonId(i)] ?? 0, cur = i === current;
                return (
                  <div key={i} className="node-wrap" style={{ transform: `translateX(${offsets[k % offsets.length]}px)` }}>
                    {cur && <div className="start-tip">START</div>}
                    <button ref={cur ? curRef : undefined} data-testid={`lesson-${i}`}
                      className={'node' + (open ? ' open' : ' locked') + (cur ? ' cur' : '') + (stars ? ' done' : '')}
                      style={open ? { '--c': color } as React.CSSProperties : undefined}
                      disabled={!open} onClick={() => go({ k: 'lesson', index: i })} aria-label={`Lesson ${i + 1}`}>
                      <span className="node-char">{open ? LESSONS[i][0].c : '🔒'}</span>
                    </button>
                    <div className="node-meta">{stars ? <Stars n={stars} /> : <small>{LESSONS[i].map(c => c.c).join(' ')}</small>}</div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="fine">More HSK levels coming later. 加油!</p>
    </main>
  );
}

const STEP_LABEL: Record<Mode, [string, string]> = {
  watch: ['Watch', 'Watch the stroke order'],
  trace: ['Trace', 'Trace over the outline'],
  quiz: ['Write', 'Write it from memory'],
};

function Lesson({ chars, title, review, onQuit, onFinish }: { chars: Char[]; title: string; review?: boolean; onQuit: () => void; onFinish: (r: P.Result[]) => void }) {
  const steps: Mode[] = review ? ['quiz'] : ['watch', 'trace', 'quiz'];
  const [ci, setCi] = useState(0);
  const [si, setSi] = useState(0);
  const [replay, setReplay] = useState(0);
  const [miss, setMiss] = useState(0);
  const [feedback, setFeedback] = useState<null | { ok: boolean; text: string; m: number }>(null);
  const [watched, setWatched] = useState(false);
  const results = useRef<P.Result[]>([]);
  const size = useSize();
  const ch = chars[ci], mode = steps[si];
  const total = chars.length * steps.length, pos = ci * steps.length + si + (feedback ? 1 : 0);
  useEffect(() => { setMiss(0); setFeedback(null); setWatched(false); }, [ci, si]);
  useEffect(() => { if (!review && si === 0) speak(ch.c); }, [ci]); // eslint-disable-line

  const onDone = (m: number) => {
    if (mode === 'watch') { setWatched(true); return; }
    if (mode === 'trace') { setFeedback({ ok: true, text: m === 0 ? 'Perfect trace!' : 'Nice tracing!', m }); return; }
    results.current = [...results.current.filter(r => r.char !== ch.c), { char: ch.c, mistakes: m }];
    const text = m === 0 ? ['Perfect!', 'Amazing!', '太棒了!', 'Flawless!'][ci % 4] : m <= 2 ? 'Great job!' : 'You got it!';
    setFeedback({ ok: true, text, m });
    confetti({ particleCount: m === 0 ? 90 : 50, spread: 70, origin: { y: 0.75 }, colors: ['#58cc02', '#ffc800', '#1cb0f6', '#ff4b4b'], disableForReducedMotion: true });
  };
  const next = () => {
    confetti.reset();
    if (si + 1 < steps.length) setSi(si + 1);
    else if (ci + 1 < chars.length) { setCi(ci + 1); setSi(0); }
    else onFinish(results.current);
  };
  const sub = STEP_LABEL[mode][1];
  return (
    <main className="lesson">
      <div className="lesson-top">
        <button className="x" onClick={onQuit} aria-label="Quit">✕</button>
        <div className="bar big"><i style={{ width: `${(pos / total) * 100}%` }} /></div>
        <span className="count">{ci + 1}/{chars.length}</span>
      </div>
      <div className="step-tabs">
        {steps.map((s, i) => <span key={s} className={i === si ? 'on' : i < si ? 'past' : ''}>{i < si ? '✓ ' : ''}{STEP_LABEL[s][0]}</span>)}
      </div>
      <h2 className="prompt">{review ? `${title}: write from memory` : sub}</h2>
      <div className="info card">
        <div className="info-main">
          <div className="py">{ch.p}</div>
          <div className="mean">{ch.m}</div>
        </div>
        {canSpeak && <button className="speak" onClick={() => speak(ch.c)} aria-label="Pronounce">🔊</button>}
        <div className="example" onClick={() => speak(ch.ex)}>
          <span className="ex-w">{ch.ex.split('').map((x, i) => <b key={i} className={x === ch.c ? 'hl' : ''}>{x}</b>)}</span>
          <span className="ex-p">{ch.exp}</span> <span className="ex-m">{ch.exm}</span>
        </div>
      </div>
      <div className="stage">
        <Writer char={ch.c} mode={mode} size={size} replayKey={replay * 10 + ci * 100 + si} onDone={onDone} onMistake={setMiss} />
        <div className="stage-note">
          {mode === 'watch' ? `${ch.n} stroke${ch.n > 1 ? 's' : ''}` :
            miss ? <span className="miss">{miss} mistake{miss > 1 ? 's' : ''}{miss >= (mode === 'trace' ? 2 : 3) ? ' · hint shown' : ''}</span> :
              mode === 'quiz' ? 'No outline: you can do it!' : 'Follow the grey outline'}
        </div>
      </div>
      <div className={'footer' + (feedback ? ' fb' : '')}>
        {feedback ? (
          <div className="feedback" data-testid="feedback">
            <div className="fb-text"><span className="tick">✓</span>{feedback.text}<small>{mode === 'quiz' ? (feedback.m ? `${feedback.m} mistake${feedback.m > 1 ? 's' : ''}` : 'No mistakes') : ''}</small></div>
            <button className="btn" onClick={next} data-testid="continue">Continue</button>
          </div>
        ) : mode === 'watch' ? (
          <div className="row">
            <button className="btn ghost" onClick={() => setReplay(replay + 1)}>↻ Replay</button>
            <button className="btn" disabled={!watched} onClick={next} data-testid="continue">{watched ? 'Got it' : 'Watching…'}</button>
          </div>
        ) : (
          <div className="row">
            <button className="btn ghost" onClick={() => setReplay(replay + 1)}>↻ Restart</button>
            {mode === 'trace' && <button className="btn ghost" onClick={next}>Skip</button>}
          </div>
        )}
      </div>
    </main>
  );
}

function Done({ s, streak, go }: { s: Extract<Screen, { k: 'done' }>; streak: number; go: (s: Screen) => void }) {
  useEffect(() => {
    const end = Date.now() + 1200;
    const f = () => {
      confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, disableForReducedMotion: true });
      confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, disableForReducedMotion: true });
      if (Date.now() < end) requestAnimationFrame(f);
    };
    f();
    return () => { confetti.reset(); };
  }, []);
  const msg = s.stars === 3 ? 'Brilliant writing!' : s.stars === 2 ? 'Great work!' : 'Good effort, keep practicing!';
  return (
    <main className="complete" data-testid="done">
      <div className="trophy">🏆</div>
      <h1>{s.title}</h1>
      <p className="sub">{msg}</p>
      <Stars n={s.stars} big />
      <div className="stats">
        <div className="stat xp"><small>XP EARNED</small><b>+{s.xp}</b></div>
        <div className="stat acc"><small>MISTAKES</small><b>{s.mistakes}</b></div>
        <div className="stat st"><small>STREAK</small><b>🔥 {streak}</b></div>
      </div>
      <div className="col">
        {s.next !== undefined && <button className="btn" onClick={() => go({ k: 'lesson', index: s.next! })}>Next lesson</button>}
        <button className={s.next !== undefined ? 'btn ghost' : 'btn'} onClick={() => go({ k: 'map' })}>Back to path</button>
      </div>
    </main>
  );
}

function CharsScreen({ prog }: { prog: P.Progress }) {
  const [sel, setSel] = useState<Char | null>(null);
  const size = useSize();
  return (
    <main className="chars">
      <h2>All {CHARS.length} characters</h2>
      <p className="fine">From the {WORDS.length} HSK 1 words. Tap to watch. Green = practiced, red dot = weak.</p>
      {sel && (
        <div className="card detail">
          <Writer char={sel.c} mode="watch" size={Math.min(size, 200)} />
          <div><div className="py">{sel.p} {canSpeak && <button className="speak sm" onClick={() => speak(sel.c)}>🔊</button>}</div><div className="mean">{sel.m}</div>
            <div className="ex-small">{sel.ex} · {sel.exp} · {sel.exm}</div></div>
        </div>
      )}
      <div className="grid">
        {CHARS.map(c => { const st = prog.chars[c.c]; return (
          <button key={c.c} className={'cell' + (st ? ' seen' : '') + (st && st.box <= 1 && st.lastMistakes > 0 ? ' weak' : '')} onClick={() => setSel(c)}>
            <b>{c.c}</b><small>{c.p}</small>
          </button>); })}
      </div>
    </main>
  );
}

function About({ prog, setProg }: { prog: P.Progress; setProg: (p: P.Progress) => void }) {
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const exportIt = () => {
    const blob = new Blob([P.exportBackup(prog)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hanzi-path-backup-${P.dayKey()}.json`; a.click();
    setMsg('Backup downloaded.');
  };
  const importIt = async (f: File) => {
    try { const p = P.parseBackup(await f.text()); setProg(p); setMsg(`Restored: ${p.xp} XP, ${Object.keys(p.lessons).length} lessons.`); }
    catch (e) { setMsg('Could not import: ' + (e as Error).message); }
  };
  const stats = useMemo(() => ({ seen: Object.keys(prog.chars).length, weak: P.weakChars(prog).length }), [prog]);
  return (
    <main className="about">
      <div className="card">
        <h3>Your progress</h3>
        <p>{prog.xp} XP · best streak {prog.best} day{prog.best === 1 ? "" : "s"} · {stats.seen} characters practiced · {stats.weak} weak</p>
        <div className="row">
          <button className="btn small" onClick={exportIt}>⬇ Export backup</button>
          <button className="btn small ghost" onClick={() => file.current?.click()}>⬆ Import</button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => e.target.files?.[0] && importIt(e.target.files[0])} />
        {msg && <p className="ok">{msg}</p>}
        <button className="link danger" onClick={() => { if (confirm('Reset all progress?')) { setProg(P.emptyProgress()); setMsg('Progress reset.'); } }}>Reset progress</button>
      </div>
      <div className="card">
        <h3>How it works</h3>
        <p>Each lesson has about 5 characters. For each one: <b>watch</b> the stroke order, <b>trace</b> it over the outline, then <b>write</b> it from memory. A hint appears after a few missed strokes. Fewer mistakes, more stars. Characters you miss come back in <b>Review</b> sooner (spaced repetition: 1, 2, 4, 7, 15, 30 days).</p>
      </div>
      <div className="card credits">
        <h3>About & credits</h3>
        <p><b>Hanzi Path 汉字路</b>, a stroke-writing practice app for HSK 1 (HSK 2.0: {WORDS.length} words, {CHARS.length} characters).</p>
        <ul>
          <li>Stroke animation and quizzes: <a href="https://github.com/chanind/hanzi-writer">Hanzi Writer</a> by David Chanin (MIT).</li>
          <li>Stroke data: <a href="https://github.com/chanind/hanzi-writer-data">hanzi-writer-data</a>, derived from <a href="https://github.com/skishore/makemeahanzi">Make Me a Hanzi</a> by Shaunak Kishore, which uses glyphs from fonts by Arphic Technology. Licensed under the <a href="./ARPHICPL.TXT">Arphic Public License</a>.</li>
          <li>HSK 1 word list: <a href="https://github.com/drkameleon/complete-hsk-vocabulary">complete-hsk-vocabulary</a> by Yanis Zafirópulos (MIT).</li>
          <li>Character readings and meanings: <a href="https://cc-cedict.org/">CC-CEDICT</a> (CC BY-SA 4.0), lightly edited.</li>
        </ul>
        <p className="fine">Works offline once loaded. Add to Home Screen from Safari's share menu.</p>
      </div>
    </main>
  );
}
