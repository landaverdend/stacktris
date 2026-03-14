import { describe, it, expect } from 'vitest';
import { GameEngine, LOCK_DELAY_FRAMES, MAX_LOCK_RESETS } from '../src/game/gameEngine.js';
import { createGameState } from '../src/game/state.js';
import { COLS, ROWS } from '../src/game/board.js';
import { ALL_PIECES } from '../src/game/pieces.js';
import type { PieceKind } from '../src/game/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Accelerate gravity and tick until the piece is floored.
 * After this returns, isFloored=true and timeOnFloor=0.
 */
function dropToFloor(engine: GameEngine): void {
  const state = engine.getState();
  state.gravity = 1; // one cell per tick instead of one per ~50
  for (let i = 0; i < ROWS + 5; i++) {
    if (state.activePiece.isFloored) break;
    engine.tick();
  }
}

// ── Becoming floored ──────────────────────────────────────────────────────────

describe('becoming floored', () => {
  it('piece is not floored at spawn', () => {
    const engine = new GameEngine({ seed: 42 });
    expect(engine.getState().activePiece.isFloored).toBe(false);
  });

  it('piece becomes floored when it can no longer move down', () => {
    const engine = new GameEngine({ seed: 42 });
    dropToFloor(engine);
    expect(engine.getState().activePiece.isFloored).toBe(true);
  });

  it('timeOnFloor is 0 immediately after landing', () => {
    const engine = new GameEngine({ seed: 42 });
    dropToFloor(engine);
    expect(engine.getState().activePiece.timeOnFloor).toBe(0);
  });
});

// ── timeOnFloor accumulation ──────────────────────────────────────────────────

describe('timeOnFloor accumulation', () => {
  it('increments by 1 each tick while floored', () => {
    const engine = new GameEngine({ seed: 42 });
    dropToFloor(engine);
    engine.tick();
    expect(engine.getState().activePiece.timeOnFloor).toBe(1);
    engine.tick();
    expect(engine.getState().activePiece.timeOnFloor).toBe(2);
  });

  it('does not lock before LOCK_DELAY_FRAMES ticks', () => {
    const engine = new GameEngine({ seed: 42 });
    dropToFloor(engine);
    for (let i = 0; i < LOCK_DELAY_FRAMES - 1; i++) engine.tick();
    const piece = engine.getState().activePiece;
    expect(piece.timeOnFloor).toBe(LOCK_DELAY_FRAMES - 1);
    expect(piece.isFloored).toBe(true);
  });

  it('locks and spawns a new piece after exactly LOCK_DELAY_FRAMES ticks', () => {
    const engine = new GameEngine({ seed: 42 });
    dropToFloor(engine);
    for (let i = 0; i < LOCK_DELAY_FRAMES; i++) engine.tick();
    const piece = engine.getState().activePiece;
    expect(piece.isFloored).toBe(false);
    expect(piece.timeOnFloor).toBe(0);
    expect(engine.getState().board.some(row => row.some(c => c !== 0))).toBe(true);
  });
});

// ── Lock delay resets ─────────────────────────────────────────────────────────

describe('lock delay resets', () => {
  it('any input while floored increments totalResets', () => {
    const engine = new GameEngine({ seed: 42 });
    dropToFloor(engine);
    engine.handleInput('move_left');
    expect(engine.getState().activePiece.totalResets).toBe(1);
    engine.handleInput('move_right');
    expect(engine.getState().activePiece.totalResets).toBe(2);
  });

  it('input while floored resets timeOnFloor to 0', () => {
    const engine = new GameEngine({ seed: 42 });
    dropToFloor(engine);
    for (let i = 0; i < 10; i++) engine.tick();
    expect(engine.getState().activePiece.timeOnFloor).toBe(10);
    engine.handleInput('move_left');
    expect(engine.getState().activePiece.timeOnFloor).toBe(0);
  });

  it('each input buys another LOCK_DELAY_FRAMES window', () => {
    const engine = new GameEngine({ seed: 42 });
    dropToFloor(engine);
    // Accumulate close to the threshold then reset
    for (let i = 0; i < LOCK_DELAY_FRAMES - 1; i++) engine.tick();
    engine.handleInput('move_left'); // resets timeOnFloor, still floored
    expect(engine.getState().activePiece.isFloored).toBe(true);
    // Should need another full window before locking
    for (let i = 0; i < LOCK_DELAY_FRAMES - 1; i++) engine.tick();
    expect(engine.getState().activePiece.isFloored).toBe(true);
  });
});

// ── Per-tetromino rotation spin-lock ─────────────────────────────────────────
//
// Each piece should consume a reset on every rotate_cw input while floored,
// regardless of whether the rotation actually moves the piece (O piece) or
// whether an SRS kick temporarily lifts it (I piece). Once MAX_LOCK_RESETS is
// reached, further rotations must not reset the lock timer.

describe('per-tetromino: rotation consumes resets', () => {
  it.each(ALL_PIECES)('%s: rotating while floored increments totalResets', (kind: PieceKind) => {
    const state = createGameState(42);
    state.activePiece.kind = kind;
    const engine = new GameEngine({ initialGameState: state });
    dropToFloor(engine);

    engine.handleInput('rotate_cw');
    expect(engine.getState().activePiece.totalResets).toBeGreaterThanOrEqual(1);
  });

  it.each(ALL_PIECES)('%s: rotating while floored resets timeOnFloor when resets remain', (kind: PieceKind) => {
    const state = createGameState(42);
    state.activePiece.kind = kind;
    const engine = new GameEngine({ initialGameState: state });
    dropToFloor(engine);

    for (let i = 0; i < 10; i++) engine.tick();
    engine.handleInput('rotate_cw');

    // If the piece is still floored after the rotation, timeOnFloor must have reset.
    // If an SRS kick lifted it off the floor (I piece), it's no longer floored so
    // the timer is irrelevant — it will restart from 0 when it lands again.
    const piece = engine.getState().activePiece;
    if (piece.isFloored) {
      expect(piece.timeOnFloor).toBe(0);
    } else {
      expect(piece.timeOnFloor).toBe(0); // fresh landing state
    }
  });

  it.each(ALL_PIECES)('%s: rotation does NOT reset timeOnFloor once resets are exhausted', (kind: PieceKind) => {
    const state = createGameState(42);
    state.activePiece.kind = kind;
    const engine = new GameEngine({ initialGameState: state });
    dropToFloor(engine);

    // Exhaust all resets, then accumulate some floor time
    engine.getState().activePiece.totalResets = MAX_LOCK_RESETS;
    for (let i = 0; i < 10; i++) engine.tick();
    const timeBefore = engine.getState().activePiece.timeOnFloor;

    engine.handleInput('rotate_cw');

    // timeOnFloor must not have decreased — the piece is out of resets
    expect(engine.getState().activePiece.timeOnFloor).toBeGreaterThanOrEqual(timeBefore);
  });

  it.each(ALL_PIECES)('%s: piece locks after LOCK_DELAY_FRAMES ticks once resets are exhausted', (kind: PieceKind) => {
    const state = createGameState(42);
    state.activePiece.kind = kind;
    const engine = new GameEngine({ initialGameState: state });
    dropToFloor(engine);

    // Exhaust resets and park the timer just before the threshold
    const piece = engine.getState().activePiece;
    piece.totalResets = MAX_LOCK_RESETS;
    piece.timeOnFloor = LOCK_DELAY_FRAMES - 1;

    engine.tick(); // should push over the threshold and trigger handleLock

    const next = engine.getState().activePiece;
    expect(next.isFloored).toBe(false);
    expect(next.timeOnFloor).toBe(0);
    expect(engine.getState().board.some(row => row.some(c => c !== 0))).toBe(true);
  });
});

// ── MAX_LOCK_RESETS exhaustion ────────────────────────────────────────────────

describe('MAX_LOCK_RESETS exhaustion', () => {
  it('timeOnFloor no longer resets after MAX_LOCK_RESETS inputs', () => {
    const engine = new GameEngine({ seed: 42 });
    dropToFloor(engine);
    engine.getState().activePiece.totalResets = MAX_LOCK_RESETS;
    for (let i = 0; i < 10; i++) engine.tick();
    const timeBefore = engine.getState().activePiece.timeOnFloor;
    engine.handleInput('move_left');
    expect(engine.getState().activePiece.timeOnFloor).toBe(timeBefore);
  });

  it('piece locks on the next tick after MAX_LOCK_RESETS with a full timer', () => {
    const engine = new GameEngine({ seed: 42 });
    dropToFloor(engine);
    const state = engine.getState();
    state.activePiece.totalResets = MAX_LOCK_RESETS;
    state.activePiece.timeOnFloor = LOCK_DELAY_FRAMES - 1;
    engine.tick(); // crosses the threshold
    const piece = engine.getState().activePiece;
    expect(piece.isFloored).toBe(false);
    expect(piece.timeOnFloor).toBe(0);
  });
});
