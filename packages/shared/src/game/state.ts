import { ActivePiece, PieceKind, SeededPieceBag } from './pieces.js';
import { Board, emptyBoard, spawnPiece } from './board.js';

export { LockDelay } from './pieces.js';

export const QUEUE_SIZE = 5;

export interface GameState {
  board: Board;
  activePiece: ActivePiece;
  queue: PieceKind[];

  bag: SeededPieceBag; // used to spawn new pieces.

  gravity: number;
  gravityAccumulator: number;

  // holdPiece: PieceKind | null;
  // holdUsed: boolean;

  // Player stats
  // score: number;
  // lines: number;
  // level: number;
  // combo: number;

  isGameOver: boolean;
}


export function createGameState(seed?: number): GameState {

  const bag = new SeededPieceBag(seed ?? Math.floor(Math.random() * 2 ** 32));
  const board = emptyBoard();

  const queue: PieceKind[] = Array.from({ length: QUEUE_SIZE }, () => bag.next());
  const activePiece = spawnPiece(board, queue.shift()!);

  return {
    board,
    activePiece,
    queue,
    bag,

    // Gravity settings 
    gravity: 0.02, // 0.02 * 50 frames = 1 row => ~0.83 seconds to fall 1 row 
    gravityAccumulator: 0, // rewinds when threshold of 1 is reached.
    
    isGameOver: false,
  }
}

// export function createGame(seed?: number): GameState {
//   const bag = new SeededPieceBag(seed ?? Math.floor(Math.random() * 2 ** 32));
//   const board = emptyBoard();

//   // Fill initial queue
//   const queue: PieceKind[] = Array.from({ length: QUEUE_SIZE }, () => bag.next());

//   // First piece comes from front of queue
//   const firstKind = queue.shift()!;
//   queue.push(bag.next());

//   const activePiece = spawnPiece(board, firstKind);

//   const state: GameState = {
//     board,
//     activePiece,
//     queue,
//     holdPiece: null,
//     holdUsed: false,

//     gravity: 0.02, // 0.02 * 50 frames = 1 row => ~0.83 seconds to fall 1 row 
//     gravityAccumulator: 0,

//     score: 0,
//     lines: 0,
//     level: 0,

//     combo: 0,
//     isGameOver: activePiece === null,
//   };

//   return { state, bag, config };
// }
