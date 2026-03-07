import React, { useEffect, useRef } from 'react';
import { TetrisBoard, NextPiece } from './TetrisBoard';
import { useTetris } from '../hooks/useTetris';
import { PlayerState } from '../types';

interface SoloArenaProps {
  onExit: () => void;
}

export const SoloArena: React.FC<SoloArenaProps> = ({ onExit }) => {
  const { state, start, moveLeft, moveRight, moveDown, rotate, hardDrop } = useTetris();
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      start();
    }
  }, [start]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); moveLeft();  break;
        case 'ArrowRight': e.preventDefault(); moveRight(); break;
        case 'ArrowDown':  e.preventDefault(); moveDown();  break;
        case 'ArrowUp':    e.preventDefault(); rotate();    break;
        case ' ':          e.preventDefault(); hardDrop();  break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [moveLeft, moveRight, moveDown, rotate, hardDrop]);

  return (
    <div className="flex justify-center items-center min-h-screen p-4 pt-14 font-mono">
      <div className="flex gap-6 items-start relative">

        {/* Left sidebar */}
        <div className="flex flex-col gap-4 w-28">
          <button
            className="border border-border-hi text-zinc-500 px-3 py-1.5 rounded text-sm cursor-pointer hover:text-zinc-300 transition-colors"
            onClick={onExit}
          >
            ← Exit
          </button>
          <StatBox label="Score" value={state.score.toLocaleString()} />
          <StatBox label="Lines" value={state.lines.toString()} />
          <StatBox label="Level" value={state.level.toString()} />
        </div>

        {/* Board */}
        <div className="relative">
          <TetrisBoard board={state.board} currentPiece={state.currentPiece} ghost={state.ghost} />
          {state.isGameOver && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4">
              <p className="text-red-500 text-3xl font-bold tracking-widest">GAME OVER</p>
              <p className="text-zinc-100 text-xl">{state.score.toLocaleString()} pts</p>
              <button
                className="bg-bitcoin text-black px-8 py-3 rounded font-bold cursor-pointer hover:opacity-90 transition-opacity"
                onClick={start}
              >
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4 w-28">
          <p className="text-zinc-600 text-xs tracking-widest">NEXT</p>
          <NextPiece piece={state.nextPiece} />
          <div className="flex flex-col gap-1 mt-2">
            <p className="text-zinc-600 text-xs tracking-widest mb-1">Controls</p>
            <p className="text-zinc-700 text-xs">← → Move</p>
            <p className="text-zinc-700 text-xs">↑ Rotate</p>
            <p className="text-zinc-700 text-xs">↓ Soft drop</p>
            <p className="text-zinc-700 text-xs">Space Hard drop</p>
          </div>
        </div>

      </div>
    </div>
  );
};

// Opponent board display (read-only, driven by server state)
interface OpponentBoardProps {
  player: PlayerState;
  label: string;
}

export const OpponentBoard: React.FC<OpponentBoardProps> = ({ player, label }) => (
  <div className="flex flex-col gap-2 items-center font-mono">
    <p className="text-zinc-500 text-sm tracking-wide">{label}</p>
    <TetrisBoard board={player.board} currentPiece={null} ghost={null} dimmed={player.isGameOver} />
    <div className="flex gap-4 text-zinc-600 text-xs">
      <span>{player.score.toLocaleString()} pts</span>
      <span>Lv {player.level}</span>
    </div>
  </div>
);

const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-surface border border-border rounded p-2">
    <p className="text-zinc-600 text-[0.65rem] tracking-widest mb-0.5">{label}</p>
    <p className="text-zinc-100 text-lg font-bold">{value}</p>
  </div>
);
