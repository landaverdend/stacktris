import { useEffect, useRef } from 'react';
import { CANVAS_HEIGHT, CELL_SIZE } from '../render/board';
import { PendingGarbage } from '@stacktris/shared';

const ROWS = 20;
const GAP = 2;
const GARBAGE_COLOR = '#888888';
const EMPTY_COLOR = '#111111';
const PIT_COLOR = '#050505';

interface Props {
  garbageStack: PendingGarbage[];
}

export function GarbageMeter({ garbageStack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = PIT_COLOR;
    ctx.fillRect(0, 0, CELL_SIZE, CANVAS_HEIGHT);

    const totalLines = Math.min(
      garbageStack.reduce((acc, g) => acc + g.lines, 0),
      ROWS
    );
    const filledFrom = ROWS - totalLines; // rows [filledFrom..19] are garbage

    for (let row = 0; row < ROWS; row++) {
      ctx.fillStyle = row >= filledFrom ? GARBAGE_COLOR : EMPTY_COLOR;
      ctx.fillRect(GAP, row * CELL_SIZE + GAP, CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2);
    }
  }, [garbageStack]);

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
