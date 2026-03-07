import { useEffect, useRef } from 'react';
import { PieceSnapshot } from '../types';
import { renderBoard, CANVAS_WIDTH, CANVAS_HEIGHT } from '../render/board';

interface Props {
  board: number[][];
  activePiece?: PieceSnapshot | null;
  dimmed?: boolean;
  label?: string;
}

export function BoardCanvas({ board, activePiece = null, dimmed = false, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) renderBoard(ctx, board, activePiece, dimmed);
  }, [board, activePiece, dimmed]);

  return (
    <div className="flex flex-col items-center gap-2 font-mono">
      {label && <p className="text-zinc-500 text-xs tracking-widest uppercase">{label}</p>}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-border-hi bg-pit block"
      />
    </div>
  );
}
