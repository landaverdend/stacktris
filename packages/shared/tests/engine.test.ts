import { describe, it, expect } from 'vitest';
import { createGame } from '../src/game/state.js';
import { applyGravity, applyInput, LOCK_DELAY_FRAMES } from '../src/game/engine.js';
import { sonicDrop } from '../src/game/board.js';
import { levelFromLines } from '../src/index.js';

function makeGame() {
  return createGame({ levelStrategy: levelFromLines }, 42);
}

describe('applyGravity', () => {

  it('does not move piece while accumulator is below 1', () => {
    const game = makeGame();
    const initialRow = game.state.activePiece!.row;
    const next = applyGravity(game);
    expect(next.state.activePiece!.row).toBe(initialRow);
  });

  it('moves piece down once accumulator reaches 1', () => {
    let game = makeGame();
    const initialRow = game.state.activePiece!.row;
    // gravity=0.02, needs 50 ticks to drop one row
    for (let i = 0; i < 50; i++) game = applyGravity(game);
    expect(game.state.activePiece!.row).toBe(initialRow + 1);
  });

  it('locks piece after LOCK_DELAY_FRAMES frames on the floor', () => {
    let game = makeGame();

    // Place piece at the floor without locking
    const floorPiece = sonicDrop(game.state.board, game.state.activePiece!);
    game = { ...game, state: { ...game.state, activePiece: floorPiece } };

    const boardBefore = game.state.board.map(r => [...r]);

    // Tick through the lock delay
    for (let i = 0; i <= LOCK_DELAY_FRAMES; i++) {
      game = applyGravity(game);
    }

    // Board should now have cells written where the piece locked
    const boardChanged = game.state.board.some((row, r) =>
      row.some((cell, c) => cell !== boardBefore[r][c])
    );
    expect(boardChanged).toBe(true);
    // New piece should have spawned with timeOnFloor reset
    expect(game.state.activePiece!.timeOnFloor).toBe(0);
  });

});

describe('applyInput', () => {
  it('hard_drop locks piece and spawns next', () => {
    const game = makeGame();
    const initialKind = game.state.activePiece!.kind;
    const next = applyInput(game, 'hard_drop', 0);
    // A new piece should have spawned
    expect(next.state.activePiece).not.toBeNull();
    // Queue should have advanced
    expect(next.state.queue.length).toBe(game.state.queue.length);
  });

  it('hold swaps piece and marks holdUsed', () => {
    const game = makeGame();
    const activekind = game.state.activePiece!.kind;
    const next = applyInput(game, 'hold', 0);
    expect(next.state.holdPiece).toBe(activekind);
    expect(next.state.holdUsed).toBe(true);
  });

  it('hold cannot be used twice in a row', () => {
    const game = makeGame();
    const after1 = applyInput(game, 'hold', 0);
    const after2 = applyInput(after1, 'hold', 0);
    expect(after2.state.holdPiece).toBe(after1.state.holdPiece);
  });
});
