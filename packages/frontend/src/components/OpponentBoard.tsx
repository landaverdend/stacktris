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
    <div className="flex flex-col items-center gap-1">
      <canvas
        ref={ref}
        width={W}
        height={H}
        className="border border-border-hi bg-pit block"
      />
      {playerName && (
        <span className="font-display font-bold text-sm tracking-tight text-phosphor/50">
          {playerName}
        </span>
      )}
    </div>
  );
}
