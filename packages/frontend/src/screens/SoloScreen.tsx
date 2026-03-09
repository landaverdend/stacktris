import { useEffect, useRef, useState } from 'react';
import { ActivePiece, visibleBoard, VISIBLE_ROW_START } from '@stacktris/shared';
import { SoloGame } from '../game/SoloGame';
import { InputHandler } from '../game/InputHandler';
import { PieceSnapshot } from '../types';
import { renderBoard, CANVAS_WIDTH, CANVAS_HEIGHT } from '../render/board';
import { renderQueue, renderHold, QUEUE_WIDTH, QUEUE_HEIGHT, HOLD_WIDTH, HOLD_HEIGHT } from '../render/queue';

interface Props {
  onExit: () => void;
}

interface Stats {
  score: number;
  lines: number;
  level: number;
}

function toSnapshot(piece: ActivePiece): PieceSnapshot {
  return {
    kind: piece.kind,
    row: piece.row - VISIBLE_ROW_START,
    col: piece.col,
    rotation: piece.rotation,
    lock_active: false,
  };
}

export function SoloScreen({ onExit }: Props) {

  // I <3 Refs 
  const gameRef = useRef<SoloGame>(new SoloGame());
  const inputRef = useRef<InputHandler>(new InputHandler(action => gameRef.current.input(action)));

  const boardCanvasRef = useRef<HTMLCanvasElement>(null);
  const queueCanvasRef = useRef<HTMLCanvasElement>(null);
  const holdCanvasRef = useRef<HTMLCanvasElement>(null);

  const rafRef = useRef<number>(0);
  const prevLinesRef = useRef<number>(0);
  const [stats, setStats] = useState<Stats>({ score: 0, lines: 0, level: 0 });

  useEffect(() => {
    const game = gameRef.current;
    const input = inputRef.current;
    game.reset();
    prevLinesRef.current = 0;

    input.attach();

    const loop = (now: number) => {
      input.tick(now);
      game.tick(now);
      const state = game.state;

      const boardCtx = boardCanvasRef.current?.getContext('2d');
      if (boardCtx) {
        const piece = state.activePiece ? toSnapshot(state.activePiece) : null;
        renderBoard(boardCtx, visibleBoard(state.board), piece);
      }

      const queueCtx = queueCanvasRef.current?.getContext('2d');
      if (queueCtx) renderQueue(queueCtx, state.queue);

      const holdCtx = holdCanvasRef.current?.getContext('2d');
      if (holdCtx) renderHold(holdCtx, state.holdPiece, state.holdUsed);

      if (state.lines !== prevLinesRef.current) {
        prevLinesRef.current = state.lines;
        setStats({ score: state.score, lines: state.lines, level: state.level });
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      input.detach();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">

      <div className="flex items-center gap-6">
        <button
          onClick={onExit}
          className="text-nerv-dim text-xs tracking-widest font-display hover:text-bitcoin transition-colors"
        >
          ← EXIT
        </button>
        <span className="font-display text-bitcoin tracking-[0.3em] text-sm">SOLO MODE</span>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex flex-col gap-1 pt-1">
          <p className="text-nerv-dim text-[9px] tracking-[0.3em] font-mono">HOLD <span className="opacity-50">// ホールド</span></p>
          <canvas ref={holdCanvasRef} width={HOLD_WIDTH} height={HOLD_HEIGHT} className="block" />
        </div>
        <canvas
          ref={boardCanvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border border-border-hi bg-pit block"
        />
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1">
            <p className="text-nerv-dim text-[9px] tracking-[0.3em] font-mono">NEXT <span className="opacity-50">// 次</span></p>
            <canvas ref={queueCanvasRef} width={QUEUE_WIDTH} height={QUEUE_HEIGHT} className="block" />
          </div>
          <div className="flex flex-col gap-3 font-mono text-nerv-dim">
            <Stat label="SCORE" jp="スコア" value={stats.score.toLocaleString()} />
            <Stat label="LINES" jp="ライン" value={String(stats.lines)} />
            <Stat label="LEVEL" jp="レベル" value={String(stats.level)} />
          </div>
        </div>
      </div>

    </div>
  );
}

function Stat({ label, jp, value }: { label: string; jp: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] tracking-[0.3em]">{label} <span className="opacity-50">// {jp}</span></span>
      <span className="text-bitcoin text-sm font-bold">{value}</span>
    </div>
  );
}
