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

  const displayName = playerName
    ? playerName.length > 10 ? playerName.slice(0, 9) + '…' : playerName
    : null;

  return (
    <div className="relative">
      <canvas
        ref={ref}
        width={W}
        height={H}
        className="border border-border-hi bg-pit block"
      />
      {displayName && (
        <div className="absolute top-0 left-0 right-0 px-1 pt-0.5">
          <span
            className="font-display font-bold text-lg tracking-widest text-teal block truncate"
            style={{ textShadow: '0 0 6px rgba(0,255,180,0.7), 0 0 14px rgba(0,255,180,0.3)' }}
          >
            {displayName.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
