import { useEffect, useRef } from 'react';
import { Board } from '@stacktris/shared';
import { renderBoard, OPPONENT_CELL_SIZE } from '../render/board';

const BUFFER_ROWS = 2;
const W = 10 * OPPONENT_CELL_SIZE;
const H = 20 * OPPONENT_CELL_SIZE;

export function OpponentBoard({ board }: { board: Board }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) renderBoard(ctx, board.slice(BUFFER_ROWS), null, false, 1, OPPONENT_CELL_SIZE);
  }, [board]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      className="border border-border-hi bg-pit block"
    />
  );
}
