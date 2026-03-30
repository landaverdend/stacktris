import { describe, it, expect, vi } from 'vitest';
import { GameEngine, GARBAGE_TABLE } from '../src/game/gameEngine.js';
import { COLS, ROWS } from '../src/game/board.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fill N bottom rows completely so a hard_drop triggers N line clears. */
function fillBottomRows(engine: GameEngine, n: number) {
  const board = engine.getState().board;
  for (let r = ROWS - n; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      board[r][c] = 1;
    }
  }
}

/** Perform a Tetris (4-line clear) on the engine. */
function doTetris(engine: GameEngine) {
  fillBottomRows(engine, 4);
  engine.handleInput('hard_drop');
}

/** Perform an easy clear (triple = 3 lines) on the engine. */
function doTriple(engine: GameEngine) {
  fillBottomRows(engine, 3);
  engine.handleInput('hard_drop');
}

// ── B2B chain state ───────────────────────────────────────────────────────────

describe('B2B chain state', () => {
  it('b2b is false initially', () => {
    const engine = new GameEngine({ seed: 42 });
    expect(engine.getState().b2b).toBe(false);
  });

  it('b2b becomes true after the first Tetris', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    expect(engine.getState().b2b).toBe(true);
  });

  it('b2b stays true after consecutive Tetrises', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    doTetris(engine);
    doTetris(engine);
    expect(engine.getState().b2b).toBe(true);
  });

  it('single line clear breaks the chain', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    fillBottomRows(engine, 1);
    engine.handleInput('hard_drop');
    expect(engine.getState().b2b).toBe(false);
  });

  it('double line clear breaks the chain', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    fillBottomRows(engine, 2);
    engine.handleInput('hard_drop');
    expect(engine.getState().b2b).toBe(false);
  });

  it('triple line clear breaks the chain', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    doTriple(engine);
    expect(engine.getState().b2b).toBe(false);
  });

  it('no-clear lock does not break the chain', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    engine.handleInput('hard_drop'); // no rows filled — no lines cleared
    expect(engine.getState().b2b).toBe(true);
  });

  it('chain can be re-armed after breaking', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    doTriple(engine); // breaks chain
    expect(engine.getState().b2b).toBe(false);
    doTetris(engine); // re-arms chain
    expect(engine.getState().b2b).toBe(true);
  });
});

// ── B2B pieceLocked event ─────────────────────────────────────────────────────

describe('B2B pieceLocked event', () => {
  it('b2b bonus flag is false on the first Tetris (chain armed, not yet active)', () => {
    const engine = new GameEngine({ seed: 42 });
    const onLocked = vi.fn();
    engine.subscribe('pieceLocked', onLocked);
    doTetris(engine);
    expect(onLocked).toHaveBeenCalledWith(expect.objectContaining({ b2b: false, linesCleared: 4 }));
  });

  it('b2b bonus flag is true on the second consecutive Tetris', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine); // arms chain
    const onLocked = vi.fn();
    engine.subscribe('pieceLocked', onLocked);
    doTetris(engine); // bonus fires
    expect(onLocked).toHaveBeenCalledWith(expect.objectContaining({ b2b: true, linesCleared: 4 }));
  });

  it('b2b bonus flag is false on an easy clear even while chain is active', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    const onLocked = vi.fn();
    engine.subscribe('pieceLocked', onLocked);
    doTriple(engine); // breaks chain, no bonus
    expect(onLocked).toHaveBeenCalledWith(expect.objectContaining({ b2b: false, linesCleared: 3 }));
  });

  it('b2b bonus flag is false on a no-clear lock', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    const onLocked = vi.fn();
    engine.subscribe('pieceLocked', onLocked);
    engine.handleInput('hard_drop'); // no lines filled
    expect(onLocked).toHaveBeenCalledWith(expect.objectContaining({ b2b: false, linesCleared: 0 }));
  });
});

// ── B2B garbage routing ───────────────────────────────────────────────────────

describe('B2B garbage routing', () => {
  it('first Tetris sends 4 lines (no B2B bonus)', () => {
    const onAttack = vi.fn();
    const engine = new GameEngine({ seed: 42 });
    engine.subscribe('attack', onAttack);
    doTetris(engine);
    expect(onAttack).toHaveBeenCalledWith(GARBAGE_TABLE[4]); // 4
  });

  it('second consecutive Tetris sends 5 lines (4 + B2B bonus)', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine); // arms chain, no bonus
    const onAttack = vi.fn();
    engine.subscribe('attack', onAttack);
    doTetris(engine); // B2B bonus fires
    expect(onAttack).toHaveBeenCalledWith(GARBAGE_TABLE[4] + 1); // 5
  });

  it('third consecutive Tetris also sends 5 lines', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    doTetris(engine);
    const onAttack = vi.fn();
    engine.subscribe('attack', onAttack);
    doTetris(engine);
    expect(onAttack).toHaveBeenCalledWith(GARBAGE_TABLE[4] + 1); // 5
  });

  it('easy clear after B2B chain sends no bonus', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    doTetris(engine); // chain active
    const onAttack = vi.fn();
    engine.subscribe('attack', onAttack);
    doTriple(engine); // breaks chain — GARBAGE_TABLE[3] = 2, no bonus
    expect(onAttack).toHaveBeenCalledWith(GARBAGE_TABLE[3]); // 2
  });

  it('Tetris immediately after chain break re-arms without bonus', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);
    doTriple(engine); // breaks chain
    const onAttack = vi.fn();
    engine.subscribe('attack', onAttack);
    doTetris(engine); // re-arms chain, no bonus yet
    expect(onAttack).toHaveBeenCalledWith(GARBAGE_TABLE[4]); // 4, not 5
  });

  it('B2B bonus still applies after pending garbage is partially cancelled', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine); // arms chain

    // Queue 2 lines of incoming garbage
    engine.addGarbage(2, 0, 0);

    const onAttack = vi.fn();
    engine.subscribe('attack', onAttack);
    doTetris(engine); // B2B Tetris: 4 + 1 = 5 attack, cancels 2 queued → 3 net
    expect(onAttack).toHaveBeenCalledWith(3);
  });

  it('no-clear lock between Tetrises does not affect bonus on next Tetris', () => {
    const engine = new GameEngine({ seed: 42 });
    doTetris(engine);             // arms chain
    engine.handleInput('hard_drop'); // no-clear — chain preserved
    const onAttack = vi.fn();
    engine.subscribe('attack', onAttack);
    doTetris(engine);             // B2B bonus should still fire
    expect(onAttack).toHaveBeenCalledWith(GARBAGE_TABLE[4] + 1); // 5
  });
});
