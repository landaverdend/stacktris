import { Board } from "./game/board.js";
import { ActivePiece, InputAction, PieceKind } from "./game/types.js";

export const COUNTDOWN_SECONDS = 3;

export const MULTIPLAYER_GRAVITY_CONFIG = {
  INTERVAL_MS: 5_000, // how often gravity level increases
  START_LEVEL: 1,      // gravity level at match start
  MAX_LEVEL: 20,       // cap
} as const;

export interface RoomInfo {
  roomId: string;
  playerCount: number;
  betSats: number;
  createdAt: number;
}

/** Full state sent to the player controlling this board. */
export interface GameSnapshot {
  board: Board;
  activePiece: ActivePiece | null;
  holdPiece: PieceKind | null;
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

export type InputBuffer = {
  action: InputAction;
  frame: number;
}[];

export type ClientMsg =
  // Room Operations
  | { type: 'create_room'; bet_sats: number }
  | { type: 'join_room'; room_id: string; }
  | { type: 'leave_room'; room_id: string }
  | { type: 'ready_update'; ready: boolean }
  | { type: 'set_player_name'; name: string }

  // Game Ops
  | { type: 'game_action'; buffer: InputBuffer; frame: number };


export interface PlayerInfo {
  playerId: string;
  playerName: string;
  ready: boolean;
  wins: number;
}

export const WINS_TO_MATCH = 3;

export type RoomStatus = "waiting" | "countdown" | "playing" | "finished"

export interface RoomState {
  roomId: string;
  players: PlayerInfo[];
  status: RoomStatus;
  matchWinnerId: string | null;
}

// ── Server → Client ───────────────────────────────────────────────────────────
export type ServerMsg =
  | { type: 'welcome'; player_id: string }
  // Room Operations
  | { type: 'room_created'; room_id: string }
  | { type: 'room_joined'; room_id: string; }
  | { type: 'room_state_update'; roomState: RoomState }

  // Game Ops
  | { type: 'game_start'; seed: number; }
  | { type: 'game_snapshot'; snapshot: GameSnapshot }
  | { type: 'game_garbage_incoming'; lines: number; triggerFrame: number }
  | { type: 'opponent_board_update'; playerId: string; board: Board }

  | { type: 'game_over'; winnerId: string | null }
  | { type: 'gravity_update'; level: number }
  | { type: 'error'; message: string };