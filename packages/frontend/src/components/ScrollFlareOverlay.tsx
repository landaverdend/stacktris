import { useAnimate } from 'motion/react';
import { useEffect } from 'react';

interface Props {
  word?: string;
  color?: string;
  rows?: number;
  fontSize?: number;
  onAnimationComplete?: () => void;
}

export function ScrollFlareOverlay({
  word = 'LOST',
  color = '#cc1111',
  rows = 8,
  fontSize = 80,
}: Props) {
  const [scope, animate] = useAnimate();

  useEffect(() => {
    async function run() {
      const el = scope.current as HTMLElement;

      // Fast strobe during entry slide
      animate(el, { opacity: [1, 0] }, { duration: 0.1, ease: 'linear', repeat: Infinity });

      // Entry: pixels so the math is exact regardless of element size
      await animate(el, { y: [window.innerHeight, 0] }, { duration: 2, ease: 'linear' });

      // Seamless loop: el is sized to content (h-auto), so half its height = exactly one set of rows
      const halfH = el.scrollHeight / 2;
      animate(el, { y: [0, -halfH] }, { duration: 6, ease: 'linear', repeat: Infinity, repeatType: 'loop' });

      // Decelerate opacity strobe
      for (const [cycleDur, reps] of [[0.1, 3], [0.25, 2], [0.6, 1], [1.0, 1]] as [number, number][]) {
        await animate(el, { opacity: [1, 0, 1] }, { duration: cycleDur, ease: 'linear', repeat: reps });
      }

      // Settle into slow breathing
      animate(el, { opacity: [1, 0.3, 1] }, { duration: 2.5, ease: 'easeInOut', repeat: Infinity });
    }
    run();
  }, []);

  const glow = `0 0 12px ${color}, 0 0 28px ${color}80`;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[3px]">
      <div className="absolute inset-0 bg-black/70" />
      <div ref={scope} className="absolute top-0 left-0 w-full flex flex-col">
        {Array.from({ length: rows * 2 }).map((_, r) => (
          <div key={r} className="flex justify-around w-full leading-[1.05]">
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
