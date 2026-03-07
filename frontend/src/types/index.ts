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

// WebSocket message types
export type ClientMessage =
  | { type: 'join_room'; roomId: string; betSats: number }
  | { type: 'create_room'; betSats: number }
  | { type: 'game_action'; action: GameAction }
  | { type: 'pay_invoice'; bolt11: string };

export type GameAction =
  | { type: 'move_left' }
  | { type: 'move_right' }
  | { type: 'move_down' }
  | { type: 'rotate' }
  | { type: 'hard_drop' };

export type ServerMessage =
  | { type: 'room_created'; roomId: string; invoice: string }
  | { type: 'room_joined'; roomId: string; invoice: string }
  | { type: 'game_start'; countdown: number }
  | { type: 'game_state'; room: GameRoom }
  | { type: 'game_over'; winnerId: string; paymentPreimage?: string }
  | { type: 'error'; message: string };
