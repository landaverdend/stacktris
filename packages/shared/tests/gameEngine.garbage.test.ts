import { describe, it, expect, vi } from 'vitest';
import { GameEngine, GARBAGE_DELAY_FRAMES } from '../src/game/gameEngine.js';
import { COLS, ROWS } from '../src/game/board.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function tickN(engine: GameEngine, n: number) {
  for (let i = 0; i < n; i++) engine.tick();
}

/** Pre-fill N bottom rows completely so a lock triggers N line clears. */
function fillBottomRows(engine: GameEngine, n: number) {
  const board = engine.getState().board;
  for (let r = ROWS - n; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      board[r][c] = 1;
    }
  }
}

// ── applyGarbageLines (via engine) ────────────────────────────────────────────

describe('addGarbage: queuing', () => {
  it('adds an entry to pendingGarbage', () => {
    const engine = new GameEngine({ seed: 42 });
    engine.addGarbage(3, GARBAGE_DELAY_FRAMES);
    expect(engine.getState().pendingGarbage.length).toBe(1);
    expect(engine.getState().pendingGarbage[0].lines).toBe(3);
  });

  it('triggerFrame is tickCount + delayTicks at time of call', () => {
    const engine = new GameEngine({ seed: 42 });
    tickN(engine, 10);
    engine.addGarbage(2, 5);
    expect(engine.getState().pendingGarbage[0].triggerFrame).toBe(15);
  });

  it('multiple addGarbage calls stack in order', () => {
    const engine = new GameEngine({ seed: 42 });
    engine.addGarbage(1, 100);
    engine.addGarbage(4, 100);
    expect(engine.getState().pendingGarbage.length).toBe(2);
    expect(engine.getState().pendingGarbage[0].lines).toBe(1);
    expect(engine.getState().pendingGarbage[1].lines).toBe(4);
  });
});

// ── Timing: garbage applies only after delay ──────────────────────────────────
describe('garbage timing', () => {
  it('does not apply before triggerFrame is reached', () => {
    const engine = new GameEngine({ seed: 42 });
    engine.addGarbage(2, 10);
    tickN(engine, 9);
    expect(engine.getState().pendingGarbage.length).toBe(1);
    expect(engine.getState().board[ROWS - 1].some(c => c === 8)).toBe(false);
  });

  it('applies on the tick that reaches triggerFrame', () => {
    const engine = new GameEngine({ seed: 42 });
    engine.addGarbage(2, 10);
    tickN(engine, 10);
    expect(engine.getState().pendingGarbage.length).toBe(0);
    expect(engine.getState().board[ROWS - 1].some(c => c === 8)).toBe(true);
    expect(engine.getState().board[ROWS - 2].some(c => c === 8)).toBe(true);
  });

  it('applies the correct number of garbage rows', () => {
    const engine = new GameEngine({ seed: 42 });
    engine.addGarbage(4, 5);
    tickN(engine, 5);
    const garbageRows = engine.getState().board.filter(row => row.some(c => c === 8));
    expect(garbageRows.length).toBe(4);
  });

  it('two entries with different delays apply independently', () => {
    const engine = new GameEngine({ seed: 42 });
    engine.addGarbage(1, 5);
    engine.addGarbage(1, 10);
    tickN(engine, 5);
    expect(engine.getState().pendingGarbage.length).toBe(1); // second still pending
    expect(engine.getState().board[ROWS - 1].some(c => c === 8)).toBe(true);
    tickN(engine, 5);
    expect(engine.getState().pendingGarbage.length).toBe(0);
  });
});

// ── Cancellation: line clears reduce the pending queue ────────────────────────

describe('garbage cancellation on line clear', () => {
  it('line clears cancel pending garbage from the front of the queue', () => {
    const engine = new GameEngine({ seed: 42 });
    engine.addGarbage(2, GARBAGE_DELAY_FRAMES);
    fillBottomRows(engine, 3);
    engine.handleInput('hard_drop');
    // 3 lines cleared → 2 attack, 2 pending → queue fully cancelled
    expect(engine.getState().pendingGarbage.length).toBe(0);
  });

  it('partial cancellation: clears fewer lines than pending', () => {
    const engine = new GameEngine({ seed: 42 });
    engine.addGarbage(4, GARBAGE_DELAY_FRAMES);
    fillBottomRows(engine, 2);
    engine.handleInput('hard_drop');
    // 2 lines cleared → 1 attack, 4 pending → 3 remain
    expect(engine.getState().pendingGarbage.length).toBe(1);
    expect(engine.getState().pendingGarbage[0].lines).toBe(3);
  });

  it('cancellation spans multiple queue entries FIFO', () => {
    const engine = new GameEngine({ seed: 42 });
    engine.addGarbage(1, GARBAGE_DELAY_FRAMES);
    engine.addGarbage(2, GARBAGE_DELAY_FRAMES);
    fillBottomRows(engine, 3);
    engine.handleInput('hard_drop');
    // 3 lines cleared → 2 attack: removes first entry (1) and takes 1 from second → 1 remains
    expect(engine.getState().pendingGarbage.length).toBe(1);
    expect(engine.getState().pendingGarbage[0].lines).toBe(1);
  });

  it('clearing more lines than queued fully drains the queue', () => {
    const engine = new GameEngine({ seed: 42 });
    engine.addGarbage(1, GARBAGE_DELAY_FRAMES);
    fillBottomRows(engine, 4);
    engine.handleInput('hard_drop');
    expect(engine.getState().pendingGarbage.length).toBe(0);
  });
});

// ── onAttack callback ─────────────────────────────────────────────────────────

describe('onAttack callback', () => {
  it('fires with full line count when queue is empty', () => {
    const onAttack = vi.fn();
    const engine = new GameEngine({ seed: 42, onAttack });
    fillBottomRows(engine, 3);
    engine.handleInput('hard_drop');
    expect(onAttack).toHaveBeenCalledWith(2);
  });

  it('does not fire when all cleared lines are absorbed by the queue', () => {
    const onAttack = vi.fn();
    const engine = new GameEngine({ seed: 42, onAttack });
    engine.addGarbage(4, GARBAGE_DELAY_FRAMES);
    fillBottomRows(engine, 2);
    engine.handleInput('hard_drop');
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('fires with the remainder after partial cancellation', () => {
    const onAttack = vi.fn();
    const engine = new GameEngine({ seed: 42, onAttack });
    engine.addGarbage(1, GARBAGE_DELAY_FRAMES);
    fillBottomRows(engine, 4);
    engine.handleInput('hard_drop');
    // 1 cancelled, 3 forwarded
    expect(onAttack).toHaveBeenCalledWith(3);
  });

  it('does not fire when no lines are cleared', () => {
    const onAttack = vi.fn();
    const engine = new GameEngine({ seed: 42, onAttack });
    engine.handleInput('hard_drop');
    expect(onAttack).not.toHaveBeenCalled();
  });
});
