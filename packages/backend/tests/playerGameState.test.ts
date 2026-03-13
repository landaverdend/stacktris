import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PlayerGameState } from "../src/playerGameState";

const SEED = 0xDEADBEEF;

describe('PlayerGameState', () => {


  it('same seed produces same initial piece', () => {
    const a = new PlayerGameState(SEED);
    const b = new PlayerGameState(SEED);
    expect(a.snapshot.activePiece?.kind).toBe(b.snapshot.activePiece?.kind);
  });

  it('different seeds can produce different initial pieces', () => {
    // Not guaranteed, but with two very different seeds it almost certainly differs
    const results = new Set(
      [0, 1, 2, 3, 4, 5, 6, 7].map(s => new PlayerGameState(s).snapshot.activePiece?.kind)
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it('is not game over initially', () => {
    const ps = new PlayerGameState(SEED);
    expect(ps.isGameOver).toBe(false);
  });

  it('pendingGarbage starts at 0', () => {
    const ps = new PlayerGameState(SEED);
    expect(ps.pendingGarbage).toBe(0);
  });

  describe('applyInput', () => {
    it('move_left moves active piece left', () => {
      const ps = new PlayerGameState(SEED);
      const before = ps.snapshot.activePiece!.col;
      ps.applyInput('move_left');
      expect(ps.snapshot.activePiece!.col).toBe(before - 1);
    });

    it('move_right moves active piece right', () => {
      const ps = new PlayerGameState(SEED);
      const before = ps.snapshot.activePiece!.col;
      ps.applyInput('move_right');
      expect(ps.snapshot.activePiece!.col).toBe(before + 1);
    });

    it('rotate_cw rotates active piece', () => {
      const ps = new PlayerGameState(SEED);
      const before = ps.snapshot.activePiece!.rotation;
      ps.applyInput('rotate_cw');
      expect(ps.snapshot.activePiece!.rotation).not.toBe(before);
    });

    it('hold stores the piece and spawns the next one', () => {
      const ps = new PlayerGameState(SEED);
      const firstPiece = ps.snapshot.activePiece!.kind;
      ps.applyInput('hold');
      expect(ps.snapshot.holdPiece).toBe(firstPiece);
      expect(ps.snapshot.activePiece!.kind).not.toBe(firstPiece);
    });

    it('hard_drop locks piece and spawns next', () => {
      const ps = new PlayerGameState(SEED);
      const firstPiece = ps.snapshot.activePiece!.kind;
      ps.applyInput('hard_drop');
      expect(ps.snapshot.activePiece!.kind).not.toBe(firstPiece);
    });

    // it('ignores input when game is over', () => {
    //   const ps = new PlayerGameState(SEED);
    //   // Fill the board to force game over via hard drops
    //   // Use enough hard drops to exhaust the stack
    //   for (let i = 0; i < 200; i++) {
    //     if (ps.isGameOver) break;
    //     ps.applyInput('hard_drop');
    //   }
    //   expect(ps.isGameOver).toBe(true);
    //   const snapshotBefore = JSON.stringify(ps.snapshot);
    //   ps.applyInput('move_left');
    //   expect(JSON.stringify(ps.snapshot)).toBe(snapshotBefore);
    // });
  });


});
