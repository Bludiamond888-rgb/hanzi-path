import { useEffect, useState } from 'react';
import Writer from './Writer';
import { BY_CHAR } from './data';
import components from './data/components.json';
import * as Parts from './parts';
import { dayKey } from './progress';

export type Component = {
  id: string; form: string; variant?: string; pinyin: string; meaning: string; tip: string; examples: string[];
};
export const COMPONENTS = components as Component[];
export const BY_PART = Object.fromEntries(COMPONENTS.map(c => [c.id, c]));

type View =
  | { k: 'list' }
  | { k: 'detail'; id: string }
  | { k: 'quiz'; id: string }
  | { k: 'write'; id: string };

function useSize() {
  const calc = () => Math.min(300, window.innerWidth - 56, Math.max(200, window.innerHeight - 480));
  const [s, setS] = useState(calc);
  useEffect(() => { const f = () => setS(calc()); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return Math.round(s);
}

function shuffle<T>(a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

export default function Components({ onBack }: { onBack: () => void }) {
  const [prog, setProg] = useState<Parts.PartsProgress>(() => Parts.load());
  const [view, setView] = useState<View>({ k: 'list' });
  useEffect(() => Parts.save(prog), [prog]);
  const today = dayKey();
  const learned = Parts.learnedCount(prog);

  const open = (id: string) => {
    setProg(p => Parts.markSeen(p, id, today));
    setView({ k: 'detail', id });
    window.scrollTo(0, 0);
  };

  return (
    <main className="parts" data-testid="parts">
      <div className="parts-top">
        <button className="x" onClick={() => view.k === 'list' ? onBack() : setView(view.k === 'detail' ? { k: 'list' } : { k: 'detail', id: view.id })} aria-label="Back">←</button>
        <div className="parts-title">
          <b>偏旁 Components</b>
          <small>{learned}/{COMPONENTS.length} learned</small>
        </div>
      </div>

      {view.k === 'list' && (
        <section className="parts-list">
          <p className="fine parts-intro">Building blocks of HSK 1 characters. Learn the form, spot it in words, then write it.</p>
          <div className="bar"><i style={{ width: `${(learned / COMPONENTS.length) * 100}%` }} /></div>
          <div className="parts-grid">
            {COMPONENTS.map(c => {
              const st = prog.parts[c.id];
              const done = Parts.isLearned(st);
              return (
                <button key={c.id} className={'parts-tile' + (done ? ' done' : st ? ' seen' : '')} onClick={() => open(c.id)} data-testid={'part-' + c.id}>
                  <span className="parts-glyph">{c.form}{c.variant ? <em>{c.variant}</em> : null}</span>
                  <span className="parts-meta"><b>{c.meaning}</b><small>{c.pinyin}</small></span>
                  {done && <span className="yin" aria-hidden>印</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {view.k === 'detail' && <Detail c={BY_PART[view.id]} st={prog.parts[view.id]} go={setView} />}
      {view.k === 'quiz' && (
        <Quiz c={BY_PART[view.id]} onDone={(ok) => {
          setProg(p => Parts.markQuiz(p, view.id, ok, today));
          setView({ k: 'detail', id: view.id });
        }} />
      )}
      {view.k === 'write' && (
        <WritePractice c={BY_PART[view.id]} onDone={(ok) => {
          setProg(p => Parts.markWrite(p, view.id, ok, today));
          setView({ k: 'detail', id: view.id });
        }} onSkip={() => setView({ k: 'detail', id: view.id })} />
      )}
    </main>
  );
}

function Detail({ c, st, go }: { c: Component; st?: Parts.PartStat; go: (v: View) => void }) {
  return (
    <section className="parts-detail" data-testid="part-detail">
      <div className="parts-hero card">
        <div className="parts-big">
          <span>{c.form}</span>
          {c.variant && <span className="parts-var" title="Side form">{c.variant}</span>}
        </div>
        <div className="py">{c.pinyin}</div>
        <div className="mean">{c.meaning}</div>
        {c.variant && <p className="parts-var-note">Full form <b>{c.form}</b> · side form <b>{c.variant}</b></p>}
        <p className="parts-tip">{c.tip}</p>
        {st && <p className="fine">{st.quizOk} quiz · {st.writeOk} write · seen {st.seen}×</p>}
      </div>
      <div className="card">
        <h3 className="parts-h3">In HSK 1</h3>
        <ul className="parts-ex">
          {c.examples.map(ch => {
            const info = BY_CHAR[ch];
            return (
              <li key={ch}>
                <span className="parts-ex-c">{ch}</span>
                <span>{info ? <><b>{info.p}</b> {info.m.split(/;\s*/)[0]}</> : ch}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="col parts-actions">
        <button className="btn" onClick={() => go({ k: 'quiz', id: c.id })} data-testid="part-quiz">Recognize</button>
        <button className="btn ghost" onClick={() => go({ k: 'write', id: c.id })} data-testid="part-write">Write it</button>
      </div>
    </section>
  );
}

function Quiz({ c, onDone }: { c: Component; onDone: (ok: boolean) => void }) {
  // Mix: glyph → meaning, or meaning → glyph (picked once per mount)
  const [askGlyph] = useState(() => Math.random() < 0.55);
  const [choices] = useState(() => {
    const others = shuffle(COMPONENTS.filter(x => x.id !== c.id)).slice(0, 3);
    return shuffle([c, ...others]);
  });
  const [picked, setPicked] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const pick = (id: string) => {
    if (picked) return;
    const good = id === c.id;
    setPicked(id); setOk(good);
  };
  return (
    <section className="parts-quiz" data-testid="part-quiz-view">
      <h2 className="prompt">{askGlyph ? 'What does this mean?' : 'Which component means…'}</h2>
      <div className="parts-prompt card">
        {askGlyph
          ? <div className="parts-prompt-g">{c.form}{c.variant ? <em>{c.variant}</em> : null}</div>
          : <div className="parts-prompt-m"><b>{c.meaning}</b><small>{c.pinyin}</small></div>}
      </div>
      <div className="parts-choices">
        {choices.map(opt => {
          const label = askGlyph ? opt.meaning : `${opt.form}${opt.variant ? ' / ' + opt.variant : ''}`;
          const cls = picked
            ? (opt.id === c.id ? 'ok' : opt.id === picked ? 'bad' : '')
            : '';
          return (
            <button key={opt.id} className={'parts-choice ' + cls} disabled={!!picked} onClick={() => pick(opt.id)} data-testid={'choice-' + opt.id}>
              {askGlyph ? <><b>{label}</b><small>{opt.pinyin}</small></> : <><span className="parts-choice-g">{opt.form}</span><small>{opt.meaning}</small></>}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="feedback" data-testid="part-quiz-fb">
          <div className="fb-text">
            <span className="tick">{ok ? '优' : '再'}</span>
            <span className="fb-t"><b>{ok ? '对!' : '加油!'}</b> {ok ? 'Correct' : `${c.form} means “${c.meaning}”`}</span>
          </div>
          <button className="btn" onClick={() => onDone(!!ok)} data-testid="part-quiz-continue">Continue</button>
        </div>
      )}
    </section>
  );
}

function WritePractice({ c, onDone, onSkip }: { c: Component; onDone: (ok: boolean) => void; onSkip: () => void }) {
  const size = useSize();
  const [miss, setMiss] = useState(0);
  const [replay, setReplay] = useState(0);
  const [mode, setMode] = useState<'watch' | 'quiz'>('watch');
  const [done, setDone] = useState(false);
  const writeChar = c.form; // practice the displayed form (hanzi-writer data available)
  const finish = (m: number) => {
    if (mode === 'watch') { setMode('quiz'); setMiss(0); return; }
    setDone(true);
    setTimeout(() => onDone(m <= 2), 400);
  };
  return (
    <section className="parts-write" data-testid="part-write-view">
      <h2 className="prompt">{mode === 'watch' ? 'Watch the strokes' : `Write ${c.form}`}</h2>
      <p className="fine">{c.meaning} · {c.pinyin}{c.variant ? ` · side form ${c.variant}` : ''}</p>
      <div className="stage">
        <Writer char={writeChar} mode={mode} size={size} replayKey={replay} onDone={finish} onMistake={setMiss} />
        <div className="stage-note">
          {mode === 'watch' ? 'Watch once, then write from memory'
            : miss ? <span className="miss">{miss} mistake{miss > 1 ? 's' : ''}</span>
              : 'No outline · 加油!'}
        </div>
      </div>
      {!done && (
        <div className="row">
          <button className="btn ghost" onClick={() => { setReplay(r => r + 1); setMiss(0); }}>{mode === 'watch' ? '↻ Replay' : '↻ Restart'}</button>
          {mode === 'watch'
            ? <button className="btn" onClick={() => { setMode('quiz'); setMiss(0); setReplay(r => r + 1); }} data-testid="part-write-ready">Got it</button>
            : <button className="btn ghost" onClick={onSkip}>Skip</button>}
        </div>
      )}
    </section>
  );
}
