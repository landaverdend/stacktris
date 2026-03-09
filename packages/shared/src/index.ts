// Shared types and game logic
// Game-core logic will live here, importable by both frontend and backend

export type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export type Board = number[][];

export interface PieceSnapshot {
  kind: PieceKind;
  row: number;
  col: number;
  rotation: number;
}

export interface PlayerSnapshot {
  board: Board;
  currentPiece: PieceSnapshot | null;
  nextPieces: PieceKind[];
  holdPiece: PieceKind | null;
  holdUsed: boolean;
  pendingGarbage: number;
  score: number;
  lines: number;
  level: number;
}

export interface OpponentSnapshot {
  board: Board;
  pendingGarbage: number;
  score: number;
  lines: number;
  level: number;
}
