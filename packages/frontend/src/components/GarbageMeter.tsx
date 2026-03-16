import { useEffect, useRef } from 'react';
import { CANVAS_HEIGHT, CELL_SIZE } from '../render/board';
import { GARBAGE_DELAY_FRAMES, PendingGarbage } from '@stacktris/shared';

const ROWS = 20;
const GAP = 2;
const EMPTY_COLOR = '#111111';
const PIT_COLOR = '#050505';

// Urgency palette: gray → orange → red
const COLOR_SAFE = '#888888';
const COLOR_WARN = '#f97316';
const COLOR_DANGER = '#cc2200';

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${b2})`;
}

// fraction: 1 = just added (safe), 0 = about to fire (danger)
function urgencyColor(fraction: number): string {
  const f = Math.max(0, Math.min(1, fraction));
  if (f >= 0.6) return COLOR_SAFE;
  if (f >= 0.3) return lerpColor(COLOR_WARN, COLOR_SAFE, (f - 0.3) / 0.3);
  return lerpColor(COLOR_DANGER, COLOR_WARN, f / 0.3);
}

interface Props {
  garbageStack: PendingGarbage[];
  getCurrentTick: () => number;
}

export function GarbageMeter({ garbageStack, getCurrentTick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stackRef = useRef(garbageStack);

  useEffect(() => { stackRef.current = garbageStack; }, [garbageStack]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const draw = () => {
      const stack = stackRef.current;
      const tick = getCurrentTick();

      ctx.fillStyle = PIT_COLOR;
      ctx.fillRect(0, 0, CELL_SIZE, CANVAS_HEIGHT);

      let row = ROWS - 1;

      for (const entry of stack) {
        const framesRemaining = Math.max(0, entry.triggerFrame - tick);
        const color = urgencyColor(framesRemaining / GARBAGE_DELAY_FRAMES);
        for (let i = 0; i < entry.lines && row >= 0; i++, row--) {
          ctx.fillStyle = color;
          ctx.fillRect(GAP, row * CELL_SIZE + GAP, CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2);
        }
      }

      while (row >= 0) {
        ctx.fillStyle = EMPTY_COLOR;
        ctx.fillRect(GAP, row * CELL_SIZE + GAP, CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2);
        row--;
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [getCurrentTick]);

  return (
    <canvas
      ref={canvasRef}
      width={CELL_SIZE}
      height={CANVAS_HEIGHT}
      style={{ width: CELL_SIZE, height: CANVAS_HEIGHT }}
      className="block border border-border-hi"
    />
  );
}
