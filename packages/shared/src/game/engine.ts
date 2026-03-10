import { ActivePiece } from './pieces.js';
import { tryMoveDown, tryMoveLeft, tryMoveRight, tryRotate, sonicDrop, lockPiece, clearLines, spawnPiece, isGrounded } from './board.js';
import { GameWithBag } from './state.js';

export type InputAction = 'move_left' | 'move_right' | 'rotate_cw' | 'rotate_ccw' | 'soft_drop' | 'hard_drop' | 'hold';

const LOCK_DELAY_MS = 500;
const MAX_LOCK_MOVES = 15;

/** One gravity tick: move piece down, start/advance lock delay, or lock when delay expires. */
export function applyGravity(game: GameWithBag, now: number): GameWithBag {
  const { state, bag, config } = game;
  if (!state.activePiece || state.isGameOver) return game;

  const moved = tryMoveDown(state.board, state.activePiece);
  if (moved) {
    // Moved down — cancel any lock delay
    return { bag, config, state: { ...state, activePiece: moved, lockDelay: null } };
  }

  // Piece is grounded
  if (state.lockDelay === null) {
    // Start the timer
    return { bag, config, state: { ...state, lockDelay: { groundedSince: now, moves: 0 } } };
  }

  if (now - state.lockDelay.groundedSince >= LOCK_DELAY_MS || state.lockDelay.moves >= MAX_LOCK_MOVES) {
    return lockAndSpawn(game);
  }

  return game;
}

/** Apply a player input action. */
export function applyInput(game: GameWithBag, action: InputAction, now: number): GameWithBag {
  const { state, bag, config } = game;
  if (!state.activePiece || state.isGameOver) return game;

  const piece = state.activePiece;

  switch (action) {
    case 'move_left': return applyMove(game, tryMoveLeft(state.board, piece), now);
    case 'move_right': return applyMove(game, tryMoveRight(state.board, piece), now);
    case 'rotate_cw': return applyMove(game, tryRotate(state.board, piece, true), now);
    case 'rotate_ccw': return applyMove(game, tryRotate(state.board, piece, false), now);
    case 'soft_drop': {
      // If already grounded (lock delay active), soft drop commits the lock immediately
      if (state.lockDelay !== null) return lockAndSpawn(game);
      return applyMove(game, tryMoveDown(state.board, piece), now);
    }
    case 'hard_drop': {
      const landed = sonicDrop(state.board, piece);
      return lockAndSpawn({ bag, config, state: { ...state, activePiece: landed, lockDelay: null } });
    }
    case 'hold': {
      if (state.holdUsed) return game;

      const incoming = state.holdPiece ?? state.queue[0];
      const queue = state.holdPiece ? [...state.queue] : [...state.queue.slice(1), bag.next()];
      const activePiece = spawnPiece(state.board, incoming);

      if (!activePiece) return { bag, config, state: { ...state, isGameOver: true } };

      return {
        bag,
        config,
        state: { ...state, activePiece, queue, holdPiece: piece.kind, holdUsed: true, lockDelay: null },
      };
    }
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

function applyMove(game: GameWithBag, moved: ActivePiece | null, now: number): GameWithBag {
  if (!moved) return game;
  const { bag, config, state } = game;

  let lockDelay = state.lockDelay;
  if (lockDelay !== null) {
    if (isGrounded(state.board, moved)) {
      // Still grounded — reset timer, spend a move
      lockDelay = { groundedSince: now, moves: lockDelay.moves + 1 };
    } else {
      // Moved off the stack — piece is airborne again
      lockDelay = null;
    }
  }

  return { bag, config, state: { ...state, activePiece: moved, lockDelay } };
}

function lockAndSpawn(game: GameWithBag): GameWithBag {
  const { state, bag, config } = game;
  if (!state.activePiece) return game;

  const board = state.board.map(r => [...r]);
  lockPiece(board, state.activePiece);
  const linesCleared = clearLines(board);

  const queue = [...state.queue];
  const nextKind = queue.shift()!;
  queue.push(bag.next());

  const activePiece = spawnPiece(board, nextKind);
  const newLines = state.lines + linesCleared;
  const level = config.levelStrategy ? config.levelStrategy(newLines) : state.level;

  return {
    bag,
    config,
    state: {
      ...state,
      board,
      activePiece,
      queue,
      holdUsed: false,
      lines: newLines,
      level,
      lockDelay: null,
      isGameOver: activePiece === null,
    },
  };
}
