import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/game/gameEngine.js';
import { createGameState } from '../src/game/state.js';
import { COLS, ROWS } from '../src/game/board.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Move piece left until it stops, return final col. */
function slideLeft(engine: GameEngine): number {
  for (let i = 0; i < COLS; i++) engine.handleInput('move_left');
  return engine.getState().activePiece.col;
}

/** Move piece right until it stops, return final col. */
function slideRight(engine: GameEngine): number {
  for (let i = 0; i < COLS; i++) engine.handleInput('move_right');
  return engine.getState().activePiece.col;
}

/** Soft-drop piece until it stops, return final row. */
function slideDown(engine: GameEngine): number {
  for (let i = 0; i < ROWS; i++) engine.handleInput('soft_drop');
  return engine.getState().activePiece.row;
}

// ── move_left ─────────────────────────────────────────────────────────────────

describe('move_left', () => {
  it('decrements col by 1', () => {
    const engine = new GameEngine(undefined, 42);
    const before = engine.getState().activePiece.col;
    engine.handleInput('move_left');
    expect(engine.getState().activePiece.col).toBe(before - 1);
  });

  it('is blocked by the left wall', () => {
    const engine = new GameEngine(undefined, 42);
    const stoppedAt = slideLeft(engine);
    engine.handleInput('move_left');
    expect(engine.getState().activePiece.col).toBe(stoppedAt);
  });

  it('is blocked by a locked cell to the left', () => {
    const state = createGameState(42);
    // Wall off col 5 so the piece can never pass it
    for (let r = ROWS - 10; r < ROWS; r++) state.board[r][5] = 1;
    const engine = new GameEngine(state);
    const stoppedAt = slideLeft(engine);
    engine.handleInput('move_left');
    expect(engine.getState().activePiece.col).toBe(stoppedAt);
  });
});

// ── move_right ────────────────────────────────────────────────────────────────

describe('move_right', () => {
  it('increments col by 1', () => {
    const engine = new GameEngine(undefined, 42);
    const before = engine.getState().activePiece.col;
    engine.handleInput('move_right');
    expect(engine.getState().activePiece.col).toBe(before + 1);
  });

  it('is blocked by the right wall', () => {
    const engine = new GameEngine(undefined, 42);
    const stoppedAt = slideRight(engine);
    engine.handleInput('move_right');
    expect(engine.getState().activePiece.col).toBe(stoppedAt);
  });

  it('is blocked by a locked cell to the right', () => {
    const state = createGameState(42);
    for (let r = ROWS - 10; r < ROWS; r++) state.board[r][COLS - 5] = 1;
    const engine = new GameEngine(state);
    const stoppedAt = slideRight(engine);
    engine.handleInput('move_right');
    expect(engine.getState().activePiece.col).toBe(stoppedAt);
  });

  it('left then right returns to original col', () => {
    const engine = new GameEngine(undefined, 42);
    const original = engine.getState().activePiece.col;
    engine.handleInput('move_left');
    engine.handleInput('move_right');
    expect(engine.getState().activePiece.col).toBe(original);
  });
});

// ── soft_drop ─────────────────────────────────────────────────────────────────

describe('soft_drop', () => {
  it('increments row by 1', () => {
    const engine = new GameEngine(undefined, 42);
    const before = engine.getState().activePiece.row;
    engine.handleInput('soft_drop');
    expect(engine.getState().activePiece.row).toBe(before + 1);
  });

  it('is blocked by the floor', () => {
    const engine = new GameEngine(undefined, 42);
    const stoppedAt = slideDown(engine);
    engine.handleInput('soft_drop');
    expect(engine.getState().activePiece.row).toBe(stoppedAt);
  });

  it('is blocked by a locked cell below', () => {
    const state = createGameState(42);
    // Fill a row near the bottom to act as a ceiling
    for (let c = 0; c < COLS; c++) state.board[ROWS - 5][c] = 1;
    const engine = new GameEngine(state);
    const stoppedAt = slideDown(engine);
    engine.handleInput('soft_drop');
    expect(engine.getState().activePiece.row).toBe(stoppedAt);
  });
});

// ── hard_drop ─────────────────────────────────────────────────────────────────

describe('hard_drop', () => {
  it('snaps piece to the floor row', () => {
    const engine = new GameEngine(undefined, 42);
    // soft-drop to find where the floor is, then reset and hard-drop
    const engineRef = new GameEngine(undefined, 42);
    const floorRow = slideDown(engineRef);

    engine.handleInput('hard_drop');
    // board should have locked cells at the floor row
    const board = engine.getState().board;
    expect(board[floorRow].some(cell => cell !== 0)).toBe(true);
  });

  it('spawns a fresh piece after locking', () => {
    const engine = new GameEngine(undefined, 42);
    engine.handleInput('hard_drop');
    const piece = engine.getState().activePiece;
    expect(piece.isFloored).toBe(false);
    expect(piece.timeOnFloor).toBe(0);
    expect(piece.totalResets).toBe(0);
  });

  it('resets holdUsed after locking', () => {
    const engine = new GameEngine(undefined, 42);
    engine.handleInput('hold');
    expect(engine.getState().holdUsed).toBe(true);
    engine.handleInput('hard_drop');
    expect(engine.getState().holdUsed).toBe(false);
  });

  it('writes locked cells onto the board', () => {
    const engine = new GameEngine(undefined, 42);
    engine.handleInput('hard_drop');
    const hasLockedCells = engine.getState().board.some(row => row.some(c => c !== 0));
    expect(hasLockedCells).toBe(true);
  });
});

// ── rotation ──────────────────────────────────────────────────────────────────

describe('rotation', () => {
  it('rotate_cw advances rotation by 1', () => {
    // Force a T piece which always rotates freely in open space
    const state = createGameState(42);
    state.activePiece.kind = 'T';
    state.activePiece.rotation = 0;
    const engine = new GameEngine(state);
    engine.handleInput('rotate_cw');
    expect(engine.getState().activePiece.rotation).toBe(1);
  });

  it('rotate_ccw retreats rotation by 1 (wraps to 3)', () => {
    const state = createGameState(42);
    state.activePiece.kind = 'T';
    state.activePiece.rotation = 0;
    const engine = new GameEngine(state);
    engine.handleInput('rotate_ccw');
    expect(engine.getState().activePiece.rotation).toBe(3);
  });

  it('four clockwise rotations return to rotation 0', () => {
    const state = createGameState(42);
    state.activePiece.kind = 'T';
    state.activePiece.rotation = 0;
    const engine = new GameEngine(state);
    for (let i = 0; i < 4; i++) engine.handleInput('rotate_cw');
    expect(engine.getState().activePiece.rotation).toBe(0);
  });

  it('rotate_cw and rotate_ccw cancel out', () => {
    const state = createGameState(42);
    state.activePiece.kind = 'T';
    state.activePiece.rotation = 0;
    const engine = new GameEngine(state);
    engine.handleInput('rotate_cw');
    engine.handleInput('rotate_ccw');
    expect(engine.getState().activePiece.rotation).toBe(0);
  });
});
