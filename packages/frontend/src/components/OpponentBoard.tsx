import { useEffect, useRef } from 'react';
import { ActivePiece, Board } from '@stacktris/shared';
import { renderBoard, OPPONENT_CELL_SIZE } from '../render/board';
import { boardDangerLevel, applyVignette, applyDangerBorderSimple } from '../game/DangerSignal';
import { ScrollFlareOverlay } from './ScrollFlareOverlay';
import { cn, truncateName } from '../lib/utils';

const BUFFER_ROWS = 2;
const W = 10 * OPPONENT_CELL_SIZE;
const H = 20 * OPPONENT_CELL_SIZE;

interface Props {
  slotIndex: number;
  board: Board;
  activePieceMapRef: React.RefObject<Map<number, ActivePiece | null>>;
  playerName?: string;
  isDead?: boolean;
  isRoundWinner?: boolean;
}

export function OpponentBoard({ slotIndex, board, activePieceMapRef, playerName, isDead, isRoundWinner }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef(board);
  boardRef.current = board; // always in sync with latest prop

  const vignetteRef = useRef<HTMLDivElement>(null);
  const borderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    const loop = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && boardRef.current) {
        const activePiece = activePieceMapRef.current?.get(slotIndex) ?? null;
        renderBoard(ctx, boardRef.current.slice(BUFFER_ROWS), activePiece, false, 1, OPPONENT_CELL_SIZE);
        const danger = boardDangerLevel(boardRef.current);
        applyVignette(vignetteRef.current, danger);
        applyDangerBorderSimple(borderRef.current, danger);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []); // runs once — reads from refs every frame

  const displayName = playerName ? truncateName(playerName, 9) : null;

  return (
    <div className="relative ">
      <div className="relative">
        {isDead && <ScrollFlareOverlay fontSize={40} />}
        {isRoundWinner && <ScrollFlareOverlay word="CLEARED" color="#00ff88" fontSize={22} />}
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="bg-pit block"
        />
        <div ref={vignetteRef} className="absolute inset-0 pointer-events-none" />
        <div ref={borderRef} className="absolute inset-0 border border-nerv-dim pointer-events-none" />
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
