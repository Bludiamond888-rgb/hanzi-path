import { useEffect, useRef } from 'react';
import HanziWriter from 'hanzi-writer';
import { STROKES } from './data';

export type Mode = 'watch' | 'trace' | 'quiz';
type Props = { char: string; mode: Mode; size: number; onDone?: (mistakes: number) => void; onMistake?: (n: number) => void; replayKey?: number };

export function TianZiGe({ size }: { size: number }) {
  const s = size, h = s / 2;
  return (
    <svg className="tzg" width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden>
      <rect x="1.5" y="1.5" width={s - 3} height={s - 3} rx="3" fill="#fbf7ee" stroke="#c8372d" strokeWidth="2.5" />
      <rect x="7" y="7" width={s - 14} height={s - 14} fill="none" stroke="#c8372d" strokeOpacity=".35" strokeWidth="1" />
      <g stroke="#c8372d" strokeOpacity=".45" strokeWidth="1.2" strokeDasharray="6 6">
        <line x1={h} y1="4" x2={h} y2={s - 4} /><line x1="4" y1={h} x2={s - 4} y2={h} />
        <line x1="10" y1="10" x2={s - 10} y2={s - 10} /><line x1={s - 10} y1="10" x2="10" y2={s - 10} />
      </g>
    </svg>
  );
}

export default function Writer({ char, mode, size, onDone, onMistake, replayKey }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef({ onDone, onMistake }); cb.current = { onDone, onMistake };
  useEffect(() => {
    const el = ref.current!; el.innerHTML = '';
    const w = HanziWriter.create(el, char, {
      width: size, height: size, padding: size * 0.08,
      charDataLoader: (c: string, done: (d: any) => void) => done(STROKES[c]),
      showCharacter: false, showOutline: mode !== 'quiz',
      strokeColor: '#1b1a17', radicalColor: '#1b1a17', outlineColor: '#e4dccb',
      highlightColor: '#c8372d', drawingColor: '#2a2723', drawingWidth: Math.max(18, size / 13),
      strokeFadeDuration: 300,
      strokeAnimationSpeed: 1.1, delayBetweenStrokes: 250,
      showHintAfterMisses: mode === 'trace' ? 2 : 3, highlightOnComplete: true,
    } as any);
    if (mode === 'watch') {
      w.animateCharacter({ onComplete: () => cb.current.onDone?.(0) });
    } else {
      let miss = 0;
      w.quiz({
        leniency: 1.1,
        onMistake: () => { miss++; cb.current.onMistake?.(miss); },
        onComplete: (s: { totalMistakes: number }) => cb.current.onDone?.(s.totalMistakes),
      } as any);
    }
    return () => { try { (w as any).cancelQuiz?.(); } catch { /* */ } el.innerHTML = ''; };
  }, [char, mode, size, replayKey]);
  return (
    <div className="writer" style={{ width: size, height: size }} data-mode={mode}>
      <TianZiGe size={size} />
      <div ref={ref} className="hw" data-testid="writer" />
    </div>
  );
}
