import { describe, it, expect } from 'vitest';
import {
  emptyBoard,
  applyGarbageLines,
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

// ── applyGarbageLines ─────────────────────────────────────────────────────────

describe('applyGarbageLines', () => {
  it('fills the bottom N rows with value 8', () => {
    const board = emptyBoard();
    applyGarbageLines(board, 2, 3);
    expect(board[ROWS - 1].filter(c => c === 8).length).toBe(COLS - 1);
    expect(board[ROWS - 2].filter(c => c === 8).length).toBe(COLS - 1);
  });

  it('leaves the gap column as 0', () => {
    const board = emptyBoard();
    applyGarbageLines(board, 1, 5);
    expect(board[ROWS - 1][5]).toBe(0);
  });

  it('all other columns in the garbage row are 8', () => {
    const board = emptyBoard();
    applyGarbageLines(board, 1, 2);
    const row = board[ROWS - 1];
    for (let c = 0; c < COLS; c++) {
      expect(row[c]).toBe(c === 2 ? 0 : 8);
    }
  });

  it('shifts existing rows up, discarding the top N rows', () => {
    const board = emptyBoard();
    board[5][0] = 7; // sentinel in the middle of the board
    applyGarbageLines(board, 1, 0);
    expect(board[4][0]).toBe(7); // shifted up by 1
  });

  it('adding garbage to an empty board results in N garbage rows and ROWS-N empty rows', () => {
    const board = emptyBoard();
    applyGarbageLines(board, 3, 0);
    const garbageRows = board.filter(row => row.some(c => c === 8));
    expect(garbageRows.length).toBe(3);
  });
});
