import { useEffect, useRef } from 'react';
import type { DangerSignal } from '../game/DangerSignal';

// Keep in sync with CSS variables in index.css
const BITCOIN = { r: 247, g: 147, b: 26 }; // --color-bitcoin
const ALERT   = { r: 204, g: 34,  b: 0  }; // --color-alert

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

interface Props {
  roundStartedAt: number | null;
  dangerSignal: DangerSignal | null;
}

export function EvaSystemClock({ roundStartedAt, dangerSignal }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLSpanElement>(null);
  const msRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const dangerRef = useRef(0);

  useEffect(() => {
    if (!dangerSignal) return;
    dangerRef.current = dangerSignal.value;
    return dangerSignal.subscribe(v => { dangerRef.current = v; });
  }, [dangerSignal]);

  useEffect(() => {
    const container = containerRef.current;
    const main = mainRef.current;
    const msEl = msRef.current;
    const statusEl = statusRef.current;
    if (!container || !main || !msEl || !statusEl) return;

    let rafId: number;

    const tick = () => {
      // ── Time ───────────────────────────────────────────────────────────────
      const elapsed = roundStartedAt ? Date.now() - roundStartedAt : 0;
      const totalSeconds = Math.floor(elapsed / 1000);
      const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
      const ss = String(totalSeconds % 60).padStart(2, '0');
      const ms = String(elapsed % 1000).padStart(3, '0');

      main.textContent = `${mm}:${ss}`;
      msEl.textContent = `.${ms}`;

      // ── Idle vs active opacity ──────────────────────────────────────────────
      if (roundStartedAt) {
        main.className = 'font-segment text-[70px] leading-none clock-reactive';
        msEl.className = 'font-segment text-[30px] leading-none mb-[5px] clock-reactive opacity-60';
        statusEl.textContent = 'ROUND ACTIVE';
        statusEl.className = 'font-mono text-[11px] tracking-[0.16em] clock-reactive opacity-70';
      } else {
        main.className = 'font-segment text-[70px] leading-none clock-reactive opacity-30';
        msEl.className = 'font-segment text-[30px] leading-none mb-[5px] clock-reactive opacity-20';
        statusEl.textContent = 'STANDBY';
        statusEl.className = 'font-mono text-[11px] tracking-[0.16em] clock-reactive opacity-30';
      }

      // ── Danger color — drives --clock-current-color on the container ────────
      const d = dangerRef.current;
      const t = Math.pow(d, 0.7);
      const r = Math.round(lerp(BITCOIN.r, ALERT.r, t));
      const g = Math.round(lerp(BITCOIN.g, ALERT.g, t));
      const b = Math.round(lerp(BITCOIN.b, ALERT.b, t));
      container.style.setProperty('--clock-current-color', `rgb(${r},${g},${b})`);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [roundStartedAt]);

  return (
    <div ref={containerRef} className="fixed bottom-5 left-5 z-40 select-none">
      <div className="bg-black border border-b-2 clock-reactive-border">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-2 py-1 border-b border-clock-border/30">
          <span className="clock-reactive-bg text-black font-jp font-bold text-[28px] px-1.5 py-0.5 border-2 border-black/50 leading-tight tracking-wider">
            危険
          </span>
          <span className="font-mono font-bold text-[18px] text-clock-label/40 tracking-[0.02em]">
            ACTIVE TIME
          </span>
        </div>

        {/* Digit display */}
        <div className="relative px-3 pt-2 pb-1.5">
          {/* Ghost (inactive) segments */}
          <div aria-hidden className="absolute top-2 left-3 flex items-end pointer-events-none">
            <span className="font-segment text-[70px] leading-none text-clock-ghost">88:88</span>
            <span className="font-segment text-[30px] leading-none text-clock-ghost mb-[5px]">.888</span>
          </div>
          {/* Active digits — mutated directly via refs */}
          <div className="relative flex items-end">
            <span ref={mainRef} className="font-segment text-[70px] leading-none clock-reactive opacity-30">
              00:00
            </span>
            <span ref={msRef} className="font-segment text-[30px] leading-none mb-[5px] clock-reactive opacity-20">
              .000
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-2 py-1 border-t border-clock-border/30">
          <span ref={statusRef} className="font-mono text-[11px] tracking-[0.16em] clock-reactive opacity-30">
            STANDBY
          </span>
          <span className="clock-reactive-bg text-black font-jp font-bold text-[28px] px-1.5 py-0.5 border-2 border-black/50 leading-tight tracking-wider">
            限界
          </span>
        </div>

      </div>
    </div>
  );
}
