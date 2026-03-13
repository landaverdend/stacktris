import { ActivePiece } from './pieces.js';
import { tryMoveDown, tryMoveLeft, tryMoveRight, tryRotate, sonicDrop, lockPiece, clearLines, spawnPiece, isGrounded, isValid } from './board.js';
import { GameContext } from './state.js';

export type InputAction = 'move_left' | 'move_right' | 'rotate_cw' | 'rotate_ccw' | 'soft_drop' | 'hard_drop' | 'hold';

const LOCK_DELAY_MS = 500;
const MAX_LOCK_MOVES = 15;

/**
 * On each frame tick, apply the current gravity to the active piece y-coordinate.
 * @param game 
 * @param frameCount 
 */
export function applyGravity(game: GameContext) {

  if (!game.state.activePiece || game.state.isGameOver) return game;

  const piece = game.state.activePiece;
  game.state.gravityAccumulator += game.state.gravity;
  const rowsToFall = Math.floor(game.state.gravityAccumulator)

  game.state.gravityAccumulator -= rowsToFall; // keep leftover fraction

  const newPiece = { ...piece, row: piece.row + rowsToFall };

  // Check if we can move down to the new row
  const canMoveDown = tryMoveDown(game.state.board, newPiece);
  if (canMoveDown) {
    piece.row = newPiece.row;
    return { ...game, state: { ...game.state, activePiece: piece } };
  } else {

  }

  return game
}

/** Apply a player input action. */
export function applyInput(game: GameContext, action: InputAction, now: number): GameContext {
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
      if (piece.lockDelay !== null) return lockAndSpawn(game);
      return applyMove(game, tryMoveDown(state.board, piece), now);
    }
    case 'hard_drop': {
      const landed = sonicDrop(state.board, piece);
      return lockAndSpawn({ bag, config, state: { ...state, activePiece: { ...landed, lockDelay: null } } });
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
        state: { ...state, activePiece, queue, holdPiece: piece.kind, holdUsed: true },
      };
    }
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

function applyMove(game: GameContext, moved: ActivePiece | null, now: number): GameContext {
  if (!moved) return game;
  const { bag, config, state } = game;
  const piece = state.activePiece!;

  let lockDelay = piece.lockDelay;
  if (lockDelay !== null) {
    if (isGrounded(state.board, moved)) {
      // Still grounded — reset timer, spend a move
      lockDelay = { groundedSince: now, moves: lockDelay.moves + 1 };
    } else {
      // Moved off the stack — piece is airborne again
      lockDelay = null;
    }
  }

  return { bag, config, state: { ...state, activePiece: { ...moved, lockDelay } } };
}

function lockAndSpawn(game: GameContext): GameContext {
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
      isGameOver: activePiece === null,
    },
  };
}
