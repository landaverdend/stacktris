import { useEffect, useRef } from 'react';
import { CANVAS_HEIGHT } from '../render/board';

const METER_WIDTH = 6;
const MAX_ROWS = 20;
// NERV threat palette: amber → orange → alert red
const COLOR_HIGH = '#cc2200';
const COLOR_MID = '#f97316';
const COLOR_LOW = '#f7931a';
const BG_COLOR = '#0a0a0a';

interface Props {
  pendingGarbage: number;
}

export function GarbageMeter({ pendingGarbage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, METER_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, METER_WIDTH, CANVAS_HEIGHT);

    if (pendingGarbage <= 0) return;

    const clamped = Math.min(pendingGarbage, MAX_ROWS);
    const fillHeight = (clamped / MAX_ROWS) * CANVAS_HEIGHT;
    const y = CANVAS_HEIGHT - fillHeight;

    ctx.fillStyle =
      clamped >= 10 ? COLOR_HIGH :
      clamped >= 5  ? COLOR_MID  :
                      COLOR_LOW;

    ctx.fillRect(0, y, METER_WIDTH, fillHeight);
  }, [pendingGarbage]);

  return (
    <canvas
      ref={canvasRef}
      width={METER_WIDTH}
      height={CANVAS_HEIGHT}
      style={{ width: METER_WIDTH, height: CANVAS_HEIGHT }}
      className="block"
    />
  );
}
