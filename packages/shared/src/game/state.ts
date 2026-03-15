import { ALL_PIECES } from './pieces.js';
import { Board, emptyBoard, spawnPiece } from './board.js';
import { ActivePiece, PieceKind } from './types.js';

export { LockDelay } from './pieces.js';

export const QUEUE_SIZE = 5;

export interface GameState {
  board: Board;
  activePiece: ActivePiece;
  bag: SeededPieceBag; // used to spawn new pieces.

  gravity: number;
  gravityAccumulator: number;

  holdPiece: PieceKind | null;
  holdUsed: boolean;

  // Player stats
  // score: number;
  lines: number;
  // level: number;
  // combo: number;
  pendingGarbage: PendingGarbage[];

  isGameOver: boolean;
}


export function createGameState(seed: number): GameState {

  const bag = new SeededPieceBag(seed);
  const board = emptyBoard();
  const activePiece = spawnPiece(board, bag.next());

  return {
    board,
    activePiece,
    bag,

    holdPiece: null,
    holdUsed: false,

    // Gravity settings 
    gravity: 0.02, // 0.02 * 50 frames = 1 row => ~0.83 seconds to fall 1 row 
    gravityAccumulator: 0, // rewinds when threshold of 1 is reached.


    lines: 0,
    pendingGarbage: [],

    isGameOver: false,
  }
}


/**
 *  
 */
export type PendingGarbage = {
  lines: number;
  triggerFrame: number;
  gap: number;
}

// ── 7-bag RNG (Mulberry32 PRNG) ───────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededPieceBag {
  private queue: PieceKind[] = [];
  private currentBag: PieceKind[] = [];
  private rng: () => number;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
    while (this.queue.length < 10) {
      this.queue.push(this.drawOne());
    }
  }

  next(): PieceKind {
    const piece = this.queue.shift()!;
    this.queue.push(this.drawOne());
    return piece;
  }

  peek(count = 10): PieceKind[] {
    return this.queue.slice(0, count);
  }

  private drawOne(): PieceKind {
    if (this.currentBag.length === 0) this.refillBag();
    return this.currentBag.pop()!;
  }

  private refillBag(): void {
    const arr: PieceKind[] = [...ALL_PIECES];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this.currentBag = arr;
  }
}
