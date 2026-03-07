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

// WebSocket message types — field names match the backend's snake_case serialization
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
  | { type: 'game_state'; room: GameRoom }
  | { type: 'game_over'; winner_id: string; your_score: number; opponent_score: number }
  | { type: 'error'; message: string };
