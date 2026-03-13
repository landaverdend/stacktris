import { describe, it, expect } from 'vitest';
import {
  emptyBoard, isValid, isGrounded,
  tryMoveDown, tryMoveLeft, tryMoveRight, tryRotate,
  sonicDrop, lockPiece, clearLines, spawnPiece,
  visibleBoard, ROWS, COLS, VISIBLE_ROW_START, VISIBLE_ROWS,
} from '../src/game/board.js';
import { ActivePiece } from '../src/game/pieces.js';

function piece(overrides: Partial<ActivePiece> = {}): ActivePiece {
  return { kind: 'T', row: 5, col: 4, rotation: 0, timeOnFloor: 0, totalResets: 15, ...overrides };
}

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

describe('isValid', () => {
  it('returns true for a piece in open space', () => {
    expect(isValid(emptyBoard(), piece())).toBe(true);
  });

  it('returns false when piece is out of bounds right', () => {
    expect(isValid(emptyBoard(), piece({ col: COLS }))).toBe(false);
  });

  it('returns false when piece is out of bounds left', () => {
    expect(isValid(emptyBoard(), piece({ col: -1 }))).toBe(false);
  });

  it('returns false when piece is below the board', () => {
    expect(isValid(emptyBoard(), piece({ row: ROWS }))).toBe(false);
  });

  it('returns false when piece overlaps an existing cell', () => {
    const board = emptyBoard();
    board[6][4] = 1; // T at row=5 rotation=0 occupies [6][4]
    expect(isValid(board, piece())).toBe(false);
  });

  it('allows piece cells in the invisible buffer (row < 0)', () => {
    const p = spawnPiece(emptyBoard(), 'T');
    expect(p).not.toBeNull();
  });
});

// ── isGrounded ────────────────────────────────────────────────────────────────

describe('isGrounded', () => {
  it('returns false when piece can still fall', () => {
    expect(isGrounded(emptyBoard(), piece({ row: 5 }))).toBe(false);
  });

  it('returns true when piece is at the bottom', () => {
    // T rotation=0 has cells at [row+1][*], so row=ROWS-2 puts cells at ROWS-1
    expect(isGrounded(emptyBoard(), piece({ row: ROWS - 2 }))).toBe(true);
  });

  it('returns true when a filled cell is directly below', () => {
    const board = emptyBoard();
    board[7][4] = 1;
    expect(isGrounded(board, piece({ row: 5 }))).toBe(true);
  });
});

// ── tryMoveDown ───────────────────────────────────────────────────────────────

describe('tryMoveDown', () => {
  it('returns piece one row lower on success', () => {
    const moved = tryMoveDown(emptyBoard(), piece({ row: 5 }));
    expect(moved?.row).toBe(6);
  });

  it('returns null when blocked at bottom', () => {
    expect(tryMoveDown(emptyBoard(), piece({ row: ROWS - 2 }))).toBeNull();
  });

  it('returns null when blocked by filled cell below', () => {
    const board = emptyBoard();
    board[7][4] = 1;
    expect(tryMoveDown(board, piece({ row: 5 }))).toBeNull();
  });
});

// ── tryMoveLeft ───────────────────────────────────────────────────────────────

describe('tryMoveLeft', () => {
  it('returns piece one col left on success', () => {
    const moved = tryMoveLeft(emptyBoard(), piece({ col: 4 }));
    expect(moved?.col).toBe(3);
  });

  it('returns null at left wall', () => {
    expect(tryMoveLeft(emptyBoard(), piece({ col: 0 }))).toBeNull();
  });
});

// ── tryMoveRight ──────────────────────────────────────────────────────────────

describe('tryMoveRight', () => {
  it('returns piece one col right on success', () => {
    const moved = tryMoveRight(emptyBoard(), piece({ col: 4 }));
    expect(moved?.col).toBe(5);
  });

  it('returns null at right wall', () => {
    // T rotation=0 spans cols [col, col+2], col=8 puts rightmost cell at 10
    expect(tryMoveRight(emptyBoard(), piece({ col: 8 }))).toBeNull();
  });
});

// ── tryRotate ─────────────────────────────────────────────────────────────────

describe('tryRotate', () => {
  it('advances rotation clockwise', () => {
    const rotated = tryRotate(emptyBoard(), piece({ rotation: 0 }), true);
    expect(rotated?.rotation).toBe(1);
  });

  it('advances rotation counter-clockwise', () => {
    const rotated = tryRotate(emptyBoard(), piece({ rotation: 0 }), false);
    expect(rotated?.rotation).toBe(3);
  });

  it('wraps rotation past 3 back to 0', () => {
    const rotated = tryRotate(emptyBoard(), piece({ rotation: 3 }), true);
    expect(rotated?.rotation).toBe(0);
  });

  it('returns null when all kick offsets are blocked', () => {
    const board = emptyBoard();
    // Fill everything around the piece so no kick can land
    for (let r = 3; r <= 8; r++)
      for (let c = 2; c <= 7; c++)
        board[r][c] = 1;
    expect(tryRotate(board, piece({ row: 5, col: 4 }), true)).toBeNull();
  });
});

// ── sonicDrop ─────────────────────────────────────────────────────────────────

describe('sonicDrop', () => {
  it('drops piece to the floor on an empty board', () => {
    const dropped = sonicDrop(emptyBoard(), piece({ row: 2 }));
    expect(isGrounded(emptyBoard(), dropped)).toBe(true);
  });

  it('stops on top of existing cells', () => {
    const board = emptyBoard();
    board[15][4] = 1;
    const dropped = sonicDrop(board, piece({ row: 2, col: 4 }));
    expect(dropped.row).toBeLessThan(15);
  });

  it('does not move a piece that is already grounded', () => {
    const p = sonicDrop(emptyBoard(), piece({ row: 2 }));
    const again = sonicDrop(emptyBoard(), p);
    expect(again.row).toBe(p.row);
  });

  it('preserves kind, col, and rotation', () => {
    const p = piece({ kind: 'I', rotation: 1 });
    const dropped = sonicDrop(emptyBoard(), p);
    expect(dropped.kind).toBe('I');
    expect(dropped.col).toBe(p.col);
    expect(dropped.rotation).toBe(1);
  });
});

// ── lockPiece ────────────────────────────────────────────────────────────────

describe('lockPiece', () => {
  it('writes piece value into the board cells', () => {
    const board = emptyBoard();
    lockPiece(board, piece({ row: 5, col: 0 }));
    // T=3, rotation=0 cells: [5+0][0+1]=absent, [5+1][0+0],[5+1][0+1],[5+1][0+2],[5+0][0+1]
    // T shape rotation 0: [[0,1],[1,0],[1,1],[1,2]]
    expect(board[5][1]).toBe(3);
    expect(board[6][0]).toBe(3);
    expect(board[6][1]).toBe(3);
    expect(board[6][2]).toBe(3);
  });

  it('does not write out-of-bounds cells', () => {
    const board = emptyBoard();
    expect(() => lockPiece(board, spawnPiece(board, 'I')!)).not.toThrow();
  });

  it('does not overwrite unrelated cells', () => {
    const board = emptyBoard();
    board[10][0] = 7;
    lockPiece(board, piece({ row: 5, col: 4 }));
    expect(board[10][0]).toBe(7);
  });
});

// ── clearLines ────────────────────────────────────────────────────────────────

describe('clearLines', () => {
  it('returns 0 when no lines are full', () => {
    expect(clearLines(emptyBoard())).toBe(0);
  });

  it('clears a single full row and returns 1', () => {
    const board = emptyBoard();
    board[ROWS - 1].fill(1);
    expect(clearLines(board)).toBe(1);
    expect(board[ROWS - 1].every(c => c === 0)).toBe(true);
  });

  it('clears multiple full rows and returns correct count', () => {
    const board = emptyBoard();
    board[ROWS - 1].fill(1);
    board[ROWS - 2].fill(1);
    expect(clearLines(board)).toBe(2);
  });

  it('shifts rows down after clearing', () => {
    const board = emptyBoard();
    board[ROWS - 1].fill(1);
    board[ROWS - 2].fill(1);
    board[ROWS - 3][0] = 2; // sentinel, should shift to ROWS-1
    clearLines(board);
    expect(board[ROWS - 1][0]).toBe(2);
  });

  it('does not clear partial rows', () => {
    const board = emptyBoard();
    board[ROWS - 1][0] = 1;
    expect(clearLines(board)).toBe(0);
  });

  it('clears up to 4 rows (tetris)', () => {
    const board = emptyBoard();
    for (let r = ROWS - 4; r < ROWS; r++) board[r].fill(1);
    expect(clearLines(board)).toBe(4);
  });
});

// ── spawnPiece ────────────────────────────────────────────────────────────────

describe('spawnPiece', () => {
  it('returns a valid piece on an empty board', () => {
    expect(spawnPiece(emptyBoard(), 'T')).not.toBeNull();
  });

  it('returns null when spawn area is blocked (top-out)', () => {
    const board = emptyBoard();
    for (let c = 0; c < COLS; c++) board[0][c] = 1;
    for (let c = 0; c < COLS; c++) board[1][c] = 1;
    expect(spawnPiece(board, 'T')).toBeNull();
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

// ── visibleBoard ──────────────────────────────────────────────────────────────

describe('visibleBoard', () => {
  it('returns exactly VISIBLE_ROWS rows', () => {
    expect(visibleBoard(emptyBoard()).length).toBe(VISIBLE_ROWS);
  });

  it('strips the invisible buffer rows', () => {
    const board = emptyBoard();
    board[0][0] = 9; // invisible row
    board[VISIBLE_ROW_START][0] = 5; // first visible row
    const visible = visibleBoard(board);
    expect(visible[0][0]).toBe(5);
  });

  it('does not include invisible buffer content', () => {
    const board = emptyBoard();
    board[0][0] = 9;
    board[1][0] = 9;
    const visible = visibleBoard(board);
    expect(visible.flat().includes(9)).toBe(false);
  });
});
