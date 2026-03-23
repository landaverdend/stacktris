import { useAnimate } from 'motion/react';
import { useEffect } from 'react';

interface Props {
  word?: string;
  /** Any valid CSS color value */
  color?: string;
  /** Number of rows of repeated text */
  rows?: number;
  /** Font size in px — scale this down for smaller boards */
  fontSize?: number;
  onAnimationComplete?: () => void;
}

export function ScrollFlareOverlay({
  word = 'LOST',
  color = '#cc1111',
  rows = 8,
  fontSize = 80,
  onAnimationComplete,
}: Props) {
  const [scope, animate] = useAnimate();

  useEffect(() => {
    async function run() {
      // Phase 1: slide up — fire blink concurrently, don't await it
      animate(
        scope.current,
        { opacity: [1, 0] },
        { duration: 0.1, ease: 'linear', repeat: Infinity }
      );
      await animate(
        scope.current,
        { y: ['110%', '0%'] },
        { duration: 3.5, ease: 'linear' }
      );
      onAnimationComplete?.();
    }
    run();
  }, []);

  const glow = `0 0 12px ${color}, 0 0 28px ${color}80`;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Static dark bg — never animates */}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.82)' }} />

      {/* Text block — slides up from below */}
      <div
        ref={scope}
        className="absolute inset-0 flex flex-col justify-center"
      >
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex justify-around w-full" style={{ lineHeight: 1.05 }}>
            {[0, 1].map(c => (
              <span
                key={c}
                className="font-display font-bold tracking-[0.02em] select-none"
                style={{ fontSize, color, textShadow: glow }}
              >
                {word}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
