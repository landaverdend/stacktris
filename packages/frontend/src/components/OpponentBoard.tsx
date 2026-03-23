import { useEffect, useRef } from 'react';
import { Board } from '@stacktris/shared';
import { renderBoard, OPPONENT_CELL_SIZE } from '../render/board';
import { ScrollFlareOverlay } from './ScrollFlareOverlay';
import { cn } from '../lib/utils';

const BUFFER_ROWS = 2;
const W = 10 * OPPONENT_CELL_SIZE;
const H = 20 * OPPONENT_CELL_SIZE;

export function OpponentBoard({ board, playerName, isDead }: { board: Board; playerName?: string; isDead?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) renderBoard(ctx, board.slice(BUFFER_ROWS), null, false, 1, OPPONENT_CELL_SIZE);
  }, [board]);

  const displayName = playerName
    ? playerName.length > 10 ? playerName.slice(0, 9) + '…' : playerName
    : null;

  return (
    <div className="relative ">
      <div className="relative">
        {isDead && <ScrollFlareOverlay fontSize={40} />}
        <canvas
          ref={ref}
          width={W}
          height={H}
          className="bg-pit block"
        />
        {/* Border rendered last so it always sits on top of the overlay */}
        <div className="absolute inset-0 border border-nerv-dim pointer-events-none" />
      </div>

      {displayName && (
        <div className="absolute top-0 left-0 right-0 px-1 pt-0.5">
          <span
            className={cn("w-fit font-display font-bold text-lg tracking-widest block truncate bg-black border-nerv-dim border px-2", isDead ? 'text-alert' : 'text-teal')}
          >
            {displayName.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
