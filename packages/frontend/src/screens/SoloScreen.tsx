import { useEffect, useRef, useState, useCallback } from 'react';
import { ActivePiece, visibleBoard, VISIBLE_ROW_START, InputAction } from '@stacktris/shared';
import { SoloGame } from '../game/SoloGame';
import { PieceSnapshot } from '../types';
import { renderBoard, CANVAS_WIDTH, CANVAS_HEIGHT } from '../render/board';
import { renderQueue, QUEUE_WIDTH, QUEUE_HEIGHT } from '../render/queue';

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
    row: piece.row - VISIBLE_ROW_START + 2,
    col: piece.col,
    rotation: piece.rotation,
    lock_active: false,
  };
}

const KEY_MAP: Record<string, InputAction> = {
  ArrowLeft:  'move_left',
  ArrowRight: 'move_right',
  ArrowDown:  'soft_drop',
  ArrowUp:    'rotate_cw',
  z:          'rotate_ccw',
  Z:          'rotate_ccw',
  ' ':        'hard_drop',
  c:          'hold',
  C:          'hold',
  Shift:      'hold',
};

export function SoloScreen({ onExit }: Props) {
  const gameRef = useRef<SoloGame>(new SoloGame());
  const boardCanvasRef = useRef<HTMLCanvasElement>(null);
  const queueCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const prevLinesRef = useRef<number>(0);
  const [stats, setStats] = useState<Stats>({ score: 0, lines: 0, level: 0 });

  // RAF loop — draws directly to canvas, no React re-renders per frame
  useEffect(() => {
    const game = gameRef.current;
    game.reset();
    prevLinesRef.current = 0;

    const loop = (now: number) => {
      game.tick(now);
      const state = game.state;

      // Board
      const boardCtx = boardCanvasRef.current?.getContext('2d');
      if (boardCtx) {
        const piece = state.activePiece ? toSnapshot(state.activePiece) : null;
        renderBoard(boardCtx, visibleBoard(state.board), piece);
      }

      // Queue
      const queueCtx = queueCanvasRef.current?.getContext('2d');
      if (queueCtx) renderQueue(queueCtx, state.queue);

      // Stats — only update React state when something meaningful changes
      if (state.lines !== prevLinesRef.current) {
        prevLinesRef.current = state.lines;
        setStats({ score: state.score, lines: state.lines, level: state.level });
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleKey = useCallback((e: KeyboardEvent) => {
    const action = KEY_MAP[e.key];
    if (!action) return;
    e.preventDefault();
    gameRef.current.input(action);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

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
