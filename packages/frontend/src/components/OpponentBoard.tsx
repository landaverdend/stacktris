import { useEffect, useRef } from 'react';
import { ActivePiece, Board } from '@stacktris/shared';
import { renderBoard, OPPONENT_CELL_SIZE } from '../render/board';
import { ScrollFlareOverlay } from './ScrollFlareOverlay';
import { cn } from '../lib/utils';

const BUFFER_ROWS = 2;
const W = 10 * OPPONENT_CELL_SIZE;
const H = 20 * OPPONENT_CELL_SIZE;

interface Props {
  playerId: string;
  board: Board;
  activePieceMapRef: React.RefObject<Map<string, ActivePiece | null>>;
  playerName?: string;
  isDead?: boolean;
}

export function OpponentBoard({ playerId, board, activePieceMapRef, playerName, isDead }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef(board);
  boardRef.current = board; // always in sync with latest prop

  useEffect(() => {
    let rafId: number;
    const loop = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        const activePiece = activePieceMapRef.current?.get(playerId) ?? null;
        renderBoard(ctx, boardRef.current.slice(BUFFER_ROWS), activePiece, false, 1, OPPONENT_CELL_SIZE);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []); // runs once — reads from refs every frame

  const displayName = playerName
    ? playerName.length > 10 ? playerName.slice(0, 9) + '…' : playerName
    : null;

  return (
    <div className="relative ">
      <div className="relative">
        {isDead && <ScrollFlareOverlay fontSize={40} />}
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="bg-pit block"
        />
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
