import { useEffect, useRef, useState } from 'react';
import { GameState, ActivePiece, visibleBoard, VISIBLE_ROW_START } from '@stacktris/shared';
import { SoloGame } from '../game/SoloGame';
import { BoardCanvas } from '../components/BoardCanvas';
import { QueueCanvas } from '../components/QueueCanvas';
import { PieceSnapshot } from '../types';

interface Props {
  onExit: () => void;
}

/** Converts shared ActivePiece (full 22-row coords) → PieceSnapshot (visible 20-row coords). */
function toSnapshot(piece: ActivePiece): PieceSnapshot {
  return {
    kind: piece.kind,
    row: piece.row - VISIBLE_ROW_START + 2,
    col: piece.col,
    rotation: piece.rotation,
    lock_active: false,
  };
}

export function SoloScreen({ onExit }: Props) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const soloRef = useRef<SoloGame | null>(null);

  useEffect(() => {
    const game = new SoloGame(setGameState);
    console.log('game', game);
    soloRef.current = game;
    game.start();
    return () => game.stop();
  }, []);

  const board = gameState ? visibleBoard(gameState.board) : null;
  const activePiece = gameState?.activePiece ? toSnapshot(gameState.activePiece) : null;

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

      {board && (
        <div className="flex items-start gap-4">
          <BoardCanvas board={board} activePiece={activePiece} />
          <div className="flex flex-col gap-4 pt-1">
            <QueueCanvas nextPieces={gameState?.queue ?? []} />
            <div className="flex flex-col gap-3 font-mono text-nerv-dim">
              <Stat label="SCORE" jp="スコア" value={gameState?.score.toLocaleString() ?? '0'} />
              <Stat label="LINES" jp="ライン" value={String(gameState?.lines ?? 0)} />
              <Stat label="LEVEL" jp="レベル" value={String(gameState?.level ?? 0)} />
            </div>
          </div>
        </div>
      )}
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
