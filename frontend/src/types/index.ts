export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export type Cell = TetrominoType | null;

export type Board = Cell[][];

export interface Position {
  x: number;
  y: number;
}

export interface Piece {
  type: TetrominoType;
  position: Position;
  rotation: number;
}

export interface PlayerState {
  id: string;
  board: Board;
  score: number;
  lines: number;
  level: number;
  isGameOver: boolean;
}

export type GamePhase = 'lobby' | 'waiting' | 'countdown' | 'playing' | 'gameover';

export interface GameRoom {
  id: string;
  players: PlayerState[];
  phase: GamePhase;
  betAmountSats: number;
  winnerId?: string;
}

// ── Snapshot types (match server protocol.rs) ─────────────────────────────────

export interface PieceSnapshot {
  kind: string;
  row: number;
  col: number;
  rotation: number;
  lock_active: boolean;
}

/** board[row][col]: 0 = empty, 1–7 = piece type (matches Piece enum). */
export interface PlayerSnapshot {
  board: number[][];
  current_piece: PieceSnapshot | null;
  next_pieces: string[];
  hold_piece: string | null;
  hold_used: boolean;
  pending_garbage: number;
  score: number;
  lines: number;
  level: number;
}

export interface OpponentSnapshot {
  board: number[][];
  pending_garbage: number;
  score: number;
  lines: number;
  level: number;
}

// ── WebSocket message types ────────────────────────────────────────────────────
export type ClientMessage =
  | { type: 'join_room'; room_id: string; bet_sats: number }
  | { type: 'create_room'; bet_sats: number }
  | { type: 'game_action'; action: GameAction };

export type GameAction =
  | { type: 'move_left' }
  | { type: 'move_right' }
  | { type: 'rotate_cw' }
  | { type: 'rotate_ccw' }
  | { type: 'soft_drop' }
  | { type: 'hard_drop' }
  | { type: 'hold' };

export type ServerMessage =
  | { type: 'room_created'; room_id: string }
  | { type: 'room_joined'; room_id: string }
  | { type: 'player_joined' }
  | { type: 'game_start'; countdown: number }
  | { type: 'game_state'; your: PlayerSnapshot; opponent: OpponentSnapshot }
  | { type: 'piece_moved'; your_piece: PieceSnapshot | null }
  | { type: 'hold_update'; hold_piece: string; your_piece: PieceSnapshot | null; next_pieces: string[] }
  | { type: 'score_update'; score: number; lines: number; level: number; combo: number }
  | { type: 'game_over'; winner_id: string; your_score: number; opponent_score: number }
  | { type: 'error'; message: string };
