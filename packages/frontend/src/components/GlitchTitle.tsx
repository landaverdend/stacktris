import { useEffect, useRef, useState } from 'react';

// ── Character pools ────────────────────────────────────────────────────────────

const BASE_TEXT = 'STACKTRIS';
const GLITCH_CHARS = '0123456789ABCDEF#_$%!?';
const ALT_TEXTS = [
  'STACKTRIS',
  'ST4CKT1S',
  '5T4CKTR15',
  'スタック',
  'ネルフ起動',
  'BLOCK:///0',
  'ERR_FATAL',
  '!!CORRUPT',
  'NULL///PTR',
  'SYS_PANIC',
];

// ── Types ──────────────────────────────────────────────────────────────────────

type TitleColor = 'amber' | 'white' | 'teal' | 'red';

// ── Helpers ───────────────────────────────────────────────────────────────────

function corruptChar(c: string, rate: number): string {
  if (c === ' ') return c;
  return Math.random() < rate
    ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
    : c;
}

function corruptText(s: string, rate: number): string {
  return s.split('').map(c => corruptChar(c, rate)).join('');
}

function randFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Component ─────────────────────────────────────────────────────────────────

export function GlitchTitle() {
  const [text, setText] = useState(BASE_TEXT);
  const [color, setColor] = useState<TitleColor>('amber');

  const hardGlitchFrames = useRef(0);
  const seizureFrames = useRef(0);
  const seizureText = useRef(BASE_TEXT);

  useEffect(() => {
    function tick() {
      // ── Hard glitch burst (every ~15–30 s at 120 ms tick) ───────────────
      if (hardGlitchFrames.current <= 0 && Math.random() < 0.003) {
        hardGlitchFrames.current = 4 + Math.floor(Math.random() * 8);
      }
      if (hardGlitchFrames.current > 0) hardGlitchFrames.current--;

      // ── Alt-text seizure (rarer, shorter) ────────────────────────────────
      if (seizureFrames.current <= 0 && Math.random() < 0.0015) {
        seizureFrames.current = 2 + Math.floor(Math.random() * 3);
        seizureText.current = randFrom(ALT_TEXTS);
      }
      if (seizureFrames.current > 0) seizureFrames.current--;

      // ── Build display text ───────────────────────────────────────────────
      let next: string;
      let nextColor: TitleColor = 'amber';

      if (seizureFrames.current > 0) {
        next = corruptText(seizureText.current, 0.2);
        nextColor = Math.random() < 0.5 ? 'red' : 'white';

      } else if (hardGlitchFrames.current > 0) {
        // Moderate scramble — not fully unreadable
        const rate = 0.12 + Math.random() * 0.2;
        next = corruptText(BASE_TEXT, rate);
        const r = Math.random();
        if (r < 0.15) nextColor = 'white';
        else if (r < 0.25) nextColor = 'red';
        else nextColor = 'amber';

      } else {
        // Idle: single stray char flicker, ~1.5% rate
        next = corruptText(BASE_TEXT, 0.015);
        // Very rare color flash
        const r = Math.random();
        if (r < 0.002) nextColor = 'teal';
        else nextColor = 'amber';
      }

      setText(next);
      setColor(nextColor);
    }

    const iv = setInterval(tick, 120);
    return () => clearInterval(iv);
  }, []);

  return (
    <h1
      className="nerv-title-text font-display font-bold tracking-[0.03em] leading-none"
      style={{ color: titleColor(color) }}
    >
      {text}
    </h1>
  );
}

function titleColor(c: TitleColor): string {
  switch (c) {
    case 'white': return 'rgba(220,255,255,0.97)';
    case 'teal': return 'rgba(0,255,180,0.92)';
    case 'red': return 'rgba(220,38,38,0.95)';
    case 'amber':
    default: return '#f7931a';
  }
}
