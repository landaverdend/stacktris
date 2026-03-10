import { ActivePiece, PieceKind, SeededPieceBag } from './pieces.js';
import { Board, emptyBoard, spawnPiece } from './board.js';

export const QUEUE_SIZE = 5;

export interface LockDelay {
  groundedSince: number; // ms timestamp when piece first became grounded
  moves: number;         // move/rotate resets used
}

export interface GameState {
  board: Board;
  activePiece: ActivePiece | null;
  queue: PieceKind[];      // next QUEUE_SIZE pieces
  holdPiece: PieceKind | null;
  holdUsed: boolean;
  score: number;
  lines: number;
  level: number;
  combo: number;
  isGameOver: boolean;
  lockDelay: LockDelay | null;
}

export interface GameConfig {
  /** Called after each lock to derive the new level from total lines cleared. Omit to leave level unchanged (server-controlled). */
  levelStrategy?: (lines: number) => number;
}

export interface GameWithBag {
  state: GameState;
  bag: SeededPieceBag;
  config: GameConfig;
}

export function createGame(config: GameConfig = {}, seed?: number): GameWithBag {
  const bag = new SeededPieceBag(seed ?? Math.floor(Math.random() * 2 ** 32));
  const board = emptyBoard();

  // Fill initial queue
  const queue: PieceKind[] = Array.from({ length: QUEUE_SIZE }, () => bag.next());

  // First piece comes from front of queue
  const firstKind = queue.shift()!;
  queue.push(bag.next());

  const activePiece = spawnPiece(board, firstKind);

  const state: GameState = {
    board,
    activePiece,
    queue,
    holdPiece: null,
    holdUsed: false,
    score: 0,
    lines: 0,
    level: 0,
    combo: 0,
    isGameOver: activePiece === null,
    lockDelay: null,
  };

  return { state, bag, config };
}
