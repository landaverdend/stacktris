import { InputAction } from './game/engine.js';

// ── Wire snapshot types ───────────────────────────────────────────────────────

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
  | { type: 'create_room'; bet_sats: number }
  | { type: 'join_room';   room_id: string; bet_sats: number }
  | { type: 'player_ready'; ready: boolean }
  | { type: 'game_action'; action: InputAction };

// ── Server → Client ───────────────────────────────────────────────────────────

export type ServerMsg =
  | { type: 'room_created';   room_id: string }
  | { type: 'room_joined';    room_id: string; player_index: 0 | 1 }
  | { type: 'player_joined' }
  | { type: 'game_start';     countdown: number }
  | { type: 'game_state';     your: PlayerSnapshot; opponent: OpponentSnapshot }
  | { type: 'piece_moved';    your_piece: PieceSnapshot | null }
  | { type: 'hold_update';    hold_piece: string; your_piece: PieceSnapshot | null; next_pieces: string[] }
  | { type: 'score_update';   score: number; lines: number; level: number; combo: number }
  | { type: 'game_over';      winner_id: string; you_won: boolean; your_score: number; opponent_score: number }
  | { type: 'ready_update';   players: { index: 0 | 1; ready: boolean }[] }
  | { type: 'opponent_disconnected' }
  | { type: 'error';          message: string };
