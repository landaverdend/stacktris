import { useAnimate } from 'motion/react';
import { useEffect } from 'react';
import { PlayerInfo } from '@stacktris/shared';

const GREEN = '#00ff88';
const GREEN_GLOW = `0 0 14px ${GREEN}, 0 0 36px ${GREEN}66`;
const GREEN_GLOW_INTENSE = `0 0 20px ${GREEN}, 0 0 60px ${GREEN}, 0 0 100px ${GREEN}44`;

// Kanji pool — victory / power themed
const KANJI = ['勝', '利', '覇', '者', '天', '無', '敵', '王', '栄', '光', '圧', '倒', '完', '全', '破', '竹'];
const ROWS = 22;

function buildColumn() {
  // duplicate so we can do a seamless half-height loop
  const single = Array.from({ length: ROWS }, (_, i) => KANJI[i % KANJI.length]);
  return [...single, ...single];
}

export function SessionWinnerOverlay({ winner, potSats }: { winner: PlayerInfo; potSats: number }) {
  const [leftScope, animateLeft] = useAnimate();
  const [rightScope, animateRight] = useAnimate();
  const [bgScope, animateBg] = useAnimate();
  const [nameScope, animateName] = useAnimate();
  const [potScope, animatePot] = useAnimate();

  useEffect(() => {
    async function run() {
      const leftEl = leftScope.current as HTMLElement;
      const rightEl = rightScope.current as HTMLElement;
      const bgEl = bgScope.current as HTMLElement;
      const nameEl = nameScope.current as HTMLElement;
      const potEl = potScope.current as HTMLElement;

      // ── Columns scroll immediately ─────────────────────────────────────────
      const halfH = leftEl.scrollHeight / 2;
      animateLeft(leftEl, { y: [0, -halfH] }, { duration: 7, ease: 'linear', repeat: Infinity, repeatType: 'loop' });
      animateRight(rightEl, { y: [-halfH, 0] }, { duration: 7, ease: 'linear', repeat: Infinity, repeatType: 'loop' });

      // ── Rapid background flash on entry ───────────────────────────────────
      await animateBg(bgEl,
        { backgroundColor: ['#000000', '#003322', '#000000', '#003322', '#000000', '#001a11', '#000000'] },
        { duration: 0.5, ease: 'linear' }
      );

      // ── Name slams in ─────────────────────────────────────────────────────
      // Fast scale-in + strobe combo
      animateName(nameEl, { scale: [4, 1] }, { duration: 0.45, ease: [0.2, 0, 0.1, 1] });
      await animateName(nameEl, { opacity: [0, 1, 0, 1, 0, 1, 0, 1] }, { duration: 0.45, ease: 'linear' });

      // Jitter left/right
      await animateName(nameEl,
        { x: [0, -6, 5, -4, 3, -2, 1, 0] },
        { duration: 0.35, ease: 'linear' }
      );

      // Keep strobing but slowing
      for (const [dur, reps] of [[0.12, 5], [0.25, 3], [0.5, 2], [0.9, 1]] as [number, number][]) {
        await animateName(nameEl, { opacity: [1, 0, 1] }, { duration: dur, ease: 'linear', repeat: reps });
      }

      // Settle — slow glow breathe
      animateName(nameEl, { opacity: [1, 0.65, 1] }, { duration: 2.2, ease: 'easeInOut', repeat: Infinity });

      // ── Pot slams in ──────────────────────────────────────────────────────
      // Flash bg again when pot appears
      animateBg(bgEl,
        { backgroundColor: ['#000000', '#002211', '#000000', '#001a0e', '#000000'] },
        { duration: 0.4, ease: 'linear' }
      );

      animatePot(potEl, { scale: [2.5, 1] }, { duration: 0.35, ease: [0.15, 0, 0.1, 1] });
      await animatePot(potEl, { opacity: [0, 1, 0, 1, 0, 1] }, { duration: 0.35, ease: 'linear' });

      // Pot jitter
      await animatePot(potEl,
        { x: [0, -4, 4, -3, 2, -1, 0] },
        { duration: 0.25, ease: 'linear' }
      );

      // Decelerate strobe on pot
      for (const [dur, reps] of [[0.15, 3], [0.4, 2], [0.8, 1]] as [number, number][]) {
        await animatePot(potEl, { opacity: [1, 0, 1] }, { duration: dur, ease: 'linear', repeat: reps });
      }
      animatePot(potEl, { opacity: [1, 0.7, 1] }, { duration: 2.8, ease: 'easeInOut', repeat: Infinity });
    }

    run();
  }, []);

  const col = buildColumn();

  return (
    <div ref={bgScope} className="absolute inset-0 overflow-hidden" style={{ backgroundColor: '#000000' }}>

      {/* ── Left column — kanji scrolling UP ── */}
      <div className="absolute left-0 top-0 h-full w-12 overflow-hidden pointer-events-none">
        <div ref={leftScope} className="flex flex-col items-center">
          {col.map((k, i) => (
            <span
              key={i}
              className="font-jp font-bold select-none leading-tight text-4xl"
              style={{ color: GREEN, textShadow: GREEN_GLOW }}
            >
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right column — kanji scrolling DOWN ── */}
      <div className="absolute right-0 top-0 h-full w-12 overflow-hidden pointer-events-none">
        <div ref={rightScope} className="flex flex-col items-center">
          {col.map((k, i) => (
            <span
              key={i}
              className="font-jp font-bold select-none leading-tight text-4xl"
              style={{ color: GREEN, textShadow: GREEN_GLOW }}
            >
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* ── Center ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-16">
        <span className="font-mono text-[9px] tracking-[0.5em] text-terminal/40 mb-1">
          SESSION VICTOR:
        </span>

        {/* Winner name */}
        <div ref={nameScope} style={{ opacity: 0, transformOrigin: 'center' }}>
          <p
            className="font-display font-bold text-center leading-none uppercase"
            style={{
              fontSize: '3rem',
              color: GREEN,
              textShadow: GREEN_GLOW_INTENSE,
              letterSpacing: '0.06em',
            }}
          >
            {winner?.playerName}
          </p>
          <p
            className="font-jp text-center text-xs tracking-[0.4em] mt-1"
            style={{ color: `${GREEN}70` }}
          >
            勝者
          </p>
        </div>

        {/* Pot / winnings */}
        <div
          ref={potScope}
          style={{ opacity: 0, transformOrigin: 'center', marginTop: '1rem' }}
          className="flex flex-col items-center gap-0.5"
        >
          {potSats > 0 ? (
            <>
              <span
                className="font-mono text-[9px] tracking-[0.45em]"
                style={{ color: `${GREEN}55` }}
              >
                // WINNINGS
              </span>
              <div className="flex items-baseline gap-2">
                {/* ghost segments */}
                <div className="relative inline-block leading-none">
                  <span
                    aria-hidden
                    className="font-segment text-[52px] leading-none absolute inset-0 select-none"
                    style={{ color: `${GREEN}0a` }}
                  >
                    {'8'.repeat(String(potSats).length)}
                  </span>
                  <span
                    className="font-segment text-[52px] leading-none relative"
                    style={{ color: GREEN, textShadow: GREEN_GLOW_INTENSE }}
                  >
                    {potSats}
                  </span>
                </div>
                <span
                  className="font-display text-sm tracking-[0.4em]"
                  style={{ color: `${GREEN}70` }}
                >
                  SATS
                </span>
              </div>
            </>
          ) : (
            <span
              className="font-mono text-[10px] tracking-[0.3em]"
              style={{ color: `${GREEN}40` }}
            >
              // FREE MATCH
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
