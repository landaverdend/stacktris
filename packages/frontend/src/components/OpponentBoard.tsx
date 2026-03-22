import { useEffect, useRef } from 'react';
import { Board } from '@stacktris/shared';
import { renderBoard, OPPONENT_CELL_SIZE } from '../render/board';

const BUFFER_ROWS = 2;
const W = 10 * OPPONENT_CELL_SIZE;
const H = 20 * OPPONENT_CELL_SIZE;

export function OpponentBoard({ board, playerName }: { board: Board; playerName?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) renderBoard(ctx, board.slice(BUFFER_ROWS), null, false, 1, OPPONENT_CELL_SIZE);
  }, [board]);

  return (
    <div className="flex items-start gap-1">
      {playerName && (
        <span
          className="font-display font-bold text-2xl tracking-widest text-teal"
          style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', textShadow: '0 0 6px rgba(0,255,180,0.7), 0 0 14px rgba(0,255,180,0.3)' }}
        >
          {playerName.toUpperCase()}
        </span>
      )}
      <canvas
        ref={ref}
        width={W}
        height={H}
        className="border border-border-hi bg-pit block"
      />
    </div>
  );
}
