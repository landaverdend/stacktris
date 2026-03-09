import { ActivePiece, PieceBag, PieceKind } from './pieces.js';
import { Board, emptyBoard, spawnPiece } from './board.js';

export const QUEUE_SIZE = 5;

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
}

export interface GameWithBag {
  state: GameState;
  bag: PieceBag;
}

export function createGame(): GameWithBag {
  const bag = new PieceBag();
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
  };

  return { state, bag };
}
