import { tryMoveDown, tryMoveLeft, tryMoveRight, tryRotate, sonicDrop, lockPiece, clearLines, spawnPiece } from './board.js';
import { GameWithBag } from './state.js';

export type InputAction = 'move_left' | 'move_right' | 'rotate_cw' | 'rotate_ccw' | 'soft_drop' | 'hard_drop' | 'hold';

/** One gravity tick: move piece down one row, or lock it if grounded. */
export function applyGravity(game: GameWithBag): GameWithBag {
  const { state, bag } = game;
  if (!state.activePiece || state.isGameOver) return game;

  const moved = tryMoveDown(state.board, state.activePiece);
  if (moved) return { bag, state: { ...state, activePiece: moved } };

  return lockAndSpawn(game);
}

/** Apply a player input action. Returns unchanged game if move is invalid. */
export function applyInput(game: GameWithBag, action: InputAction): GameWithBag {
  const { state, bag } = game;
  if (!state.activePiece || state.isGameOver) return game;

  const piece = state.activePiece;

  switch (action) {
    case 'move_left':  return applyMove(game, tryMoveLeft(state.board, piece));
    case 'move_right': return applyMove(game, tryMoveRight(state.board, piece));
    case 'rotate_cw':  return applyMove(game, tryRotate(state.board, piece, true));
    case 'rotate_ccw': return applyMove(game, tryRotate(state.board, piece, false));
    case 'soft_drop':  return applyMove(game, tryMoveDown(state.board, piece));
    case 'hard_drop': {
      const landed = sonicDrop(state.board, piece);
      return lockAndSpawn({ bag, state: { ...state, activePiece: landed } });
    }
    case 'hold': {
      if (state.holdUsed) return game;

      const incoming = state.holdPiece ?? state.queue[0];
      const queue = state.holdPiece ? [...state.queue] : [...state.queue.slice(1), bag.next()];
      const activePiece = spawnPiece(state.board, incoming);

      if (!activePiece) return { bag, state: { ...state, isGameOver: true } };

      return {
        bag,
        state: { ...state, activePiece, queue, holdPiece: piece.kind, holdUsed: true },
      };
    }
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

function applyMove(game: GameWithBag, moved: ReturnType<typeof tryMoveLeft>): GameWithBag {
  if (!moved) return game;
  return { bag: game.bag, state: { ...game.state, activePiece: moved } };
}

function lockAndSpawn(game: GameWithBag): GameWithBag {
  const { state, bag } = game;
  if (!state.activePiece) return game;

  // Stamp piece onto a fresh board copy
  const board = state.board.map(r => [...r]);
  lockPiece(board, state.activePiece);
  const linesCleared = clearLines(board);

  // Advance queue: pull next piece from front, replenish from bag
  const queue = [...state.queue];
  const nextKind = queue.shift()!;
  queue.push(bag.next());

  const activePiece = spawnPiece(board, nextKind);

  return {
    bag,
    state: {
      ...state,
      board,
      activePiece,
      queue,
      holdUsed: false,
      lines: state.lines + linesCleared,
      isGameOver: activePiece === null,
    },
  };
}
