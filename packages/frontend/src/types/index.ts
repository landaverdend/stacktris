
export type GamePhase = 'lobby' | 'waiting' | 'countdown' | 'playing' | 'gameover';

// ── Snapshot types (match server protocol.rs) ─────────────────────────────────

export interface PieceSnapshot {
  kind: string;
  row: number;
  col: number;
  rotation: number;
  lock_active: boolean;
}


// ── Game status / lobby state types ──────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ReadyPlayer {
  index: 0 | 1;
  ready: boolean;
}


/** Room lifecycle status — like GameStatus but without per-tick snapshot data. */
export type RoomStatus =
  | { status: 'lobby' }
  | { status: 'waiting_opponent'; roomId: string; myIndex: 0 | 1; players: ReadyPlayer[] }
  | { status: 'countdown'; roomId: string; from: number }
  | { status: 'playing'; roomId: string }
  | { status: 'result'; youWon: boolean; yourScore: number; opponentScore: number };
