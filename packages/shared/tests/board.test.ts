import { describe, it, expect } from 'vitest';
import {
  emptyBoard,
  spawnPiece,
  ROWS, COLS,
} from '../src/game/board.js';



// ── emptyBoard ────────────────────────────────────────────────────────────────

describe('emptyBoard', () => {
  it('has correct dimensions', () => {
    const board = emptyBoard();
    expect(board.length).toBe(ROWS);
    expect(board[0].length).toBe(COLS);
  });

  it('is entirely empty', () => {
    const board = emptyBoard();
    expect(board.every(row => row.every(cell => cell === 0))).toBe(true);
  });
});

// ── isValid ───────────────────────────────────────────────────────────────────
// ── isGrounded ────────────────────────────────────────────────────────────────
// ── lockPiece ────────────────────────────────────────────────────────────────
// describe('lockPiece', () => {
//   it('writes piece value into the board cells', () => {
//     const board = emptyBoard();
//     lockPiece(board, piece({ row: 5, col: 0 }));
//     // T=3, rotation=0 cells: [5+0][0+1]=absent, [5+1][0+0],[5+1][0+1],[5+1][0+2],[5+0][0+1]
//     // T shape rotation 0: [[0,1],[1,0],[1,1],[1,2]]
//     expect(board[5][1]).toBe(3);
//     expect(board[6][0]).toBe(3);
//     expect(board[6][1]).toBe(3);
//     expect(board[6][2]).toBe(3);
//   });

//   it('does not write out-of-bounds cells', () => {
//     const board = emptyBoard();
//     expect(() => lockPiece(board, spawnPiece(board, 'I')!)).not.toThrow();
//   });

//   it('does not overwrite unrelated cells', () => {
//     const board = emptyBoard();
//     board[10][0] = 7;
//     lockPiece(board, piece({ row: 5, col: 4 }));
//     expect(board[10][0]).toBe(7);
//   });
// });

// ── spawnPiece ────────────────────────────────────────────────────────────────

describe('spawnPiece', () => {
  it('returns a valid piece on an empty board', () => {
    expect(spawnPiece(emptyBoard(), 'T')).not.toBeNull();
  });

  it('spawns with timeOnFloor = 0', () => {
    expect(spawnPiece(emptyBoard(), 'I')?.timeOnFloor).toBe(0);
  });

  it('spawns all piece kinds without error', () => {
    const kinds = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
    for (const kind of kinds) {
      expect(spawnPiece(emptyBoard(), kind)).not.toBeNull();
    }
  });
});
