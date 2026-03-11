
export const COUNTDOWN_SECONDS = 3;

export interface RoomInfo {
  roomId: string;
  playerCount: number;
  betSats: number;
  createdAt: number;
}

/** Active piece position sent over the wire. */
export interface PieceSnapshot {
  kind: string;
  row: number;
  col: number;
  rotation: number;
  lock_active: boolean;
}

/** Full state sent to the player controlling this board. */
export interface PlayerSnapshot {
  board: number[][];          // [row][col] 0=empty 1-7=piece 8=garbage
  current_piece: PieceSnapshot | null;
  next_pieces: string[];
  hold_piece: string | null;
  hold_used: boolean;
  pending_garbage: number;
  score: number;
  lines: number;
  level: number;
}

/** Reduced state sent to the opponent (no queue/hold to prevent prefetch advantage). */
export interface OpponentSnapshot {
  board: number[][];
  pending_garbage: number;
  score: number;
  lines: number;
  level: number;
}

// ── Client → Server ───────────────────────────────────────────────────────────

export type ClientMsg =
  // Room Operations
  | { type: 'create_room'; bet_sats: number }
  | { type: 'join_room'; room_id: string; }
  | { type: 'leave_room'; room_id: string }
  | { type: 'ready_update'; ready: boolean };



export interface PlayerInfo {
  playerId: string;
  ready: boolean;
}


export type RoomStatus = "waiting" | "countdown" | "playing" | "finished"

export interface RoomState {
  roomId: string;
  players: PlayerInfo[];
  status: RoomStatus;
}

// ── Server → Client ───────────────────────────────────────────────────────────
export type ServerMsg =
  | { type: 'welcome'; player_id: string }
  // Room Operations
  | { type: 'room_created'; room_id: string }
  | { type: 'room_joined'; room_id: string; }
  | { type: 'room_state_update'; roomState: RoomState }

  // Game Ops



  | { type: 'error'; message: string };