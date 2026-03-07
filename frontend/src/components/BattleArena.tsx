import React from 'react';
import { TetrisBoard } from './TetrisBoard';
import { PlayerState } from '../types';

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

export const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-surface border border-border rounded p-2">
    <p className="text-zinc-600 text-[0.65rem] tracking-widest mb-0.5">{label}</p>
    <p className="text-zinc-100 text-lg font-bold">{value}</p>
  </div>
);
