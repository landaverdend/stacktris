import { Board } from './game/board.js';
import { PendingGarbage } from './game/state.js';
import { ActivePiece, InputAction, PieceKind } from './game/types.js';

export const COUNTDOWN_SECONDS = 3;

export const MULTIPLAYER_GRAVITY_CONFIG = {
  INTERVAL_MS: 45_000, // how often gravity level increases
  START_LEVEL: 1, // gravity level at match start
  MAX_LEVEL: 20, // cap
} as const;

export interface RoomInfo {
  roomId: string;
  playerCount: number;
  buyIn: number;
  createdAt: number;
}

export interface GameFrame {
  board: Board;
  activePiece: ActivePiece;
  gravityLevel: number;
  holdPiece: PieceKind | null;
  holdUsed: boolean;
  isGameOver: boolean;
  pendingGarbage: PendingGarbage[];
  bagPosition: number;
  frame: number;
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
  | { type: 'create_room'; buy_in: number }
  | { type: 'join_room'; room_id: string }
  | { type: 'leave_room'; room_id: string }
  | { type: 'ready_update'; ready: boolean }
  | { type: 'set_player_name'; name: string; lightning_address?: string }
  | { type: 'piece_locked'; board: Board }

  // Game Ops
  | { type: 'game_action'; buffer: InputBuffer; frame: number }
  | { type: 'game_state_heartbeat'; state: GameFrame }
  | { type: 'player_died' };

export interface PlayerInfo {
  playerId: string;
  slotIndex: number;
  playerName: string;
  ready: boolean;
  paid: boolean;
  wins: number;
}

export const WINS_TO_MATCH = 3;

export type SessionStatus = 'waiting' | 'countdown' | 'intermission' | 'playing' | 'finished';

export interface SessionState {
  roomId: string;
  players: PlayerInfo[];
  status: SessionStatus;
  roundWinnerId: string | null; // Winner of the last round.
  matchWinnerId: string | null; // Winner of the session
  buyIn: number;
  potSats: number; // Confirmed held sats — only increases, accurate even after forfeits
}

export type Message = ClientMsg | ServerMsg;

// ── Server → Client ───────────────────────────────────────────────────────────
export type ServerMsg =
  | { type: 'welcome'; player_id: string }
  // Room Operations
  | { type: 'session_created'; room_id: string }
  | { type: 'session_joined'; room_id: string }
  | { type: 'session_state_update'; roomState: SessionState }
  | { type: 'bet_invoice_issued'; bolt11: string; expiresAt: number }
  | { type: 'bet_payment_confirmed'; slotIndex: number }

  // Game Ops
  | { type: 'game_start'; seed: number; roundStartTime: number }
  | { type: 'game_state_update'; frame: GameFrame }
  | { type: 'game_garbage_incoming'; lines: number; triggerFrame: number }
  | { type: 'opponent_board_update'; slotIndex: number; board: Board }
  | { type: 'game_player_died'; slotIndex: number }
  | { type: 'opponent_piece_update'; slotIndex: number; activePiece: ActivePiece | null }
  | { type: 'gravity_update'; level: number }
  | { type: 'error'; message: string }
  | { type: 'payout_pending'; amountSats: number; lightningAddress: string };
