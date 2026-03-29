import { sonicDrop } from './movements.js';
import { PIECE_VALUE, boardCells, spawnCol } from './pieces.js';
import { ActivePiece, PieceKind } from './types.js';

export const ROWS = 22;   // 2 invisible buffer rows at top + 20 visible
export const COLS = 10;
export const VISIBLE_ROWS = 20;
export const VISIBLE_ROW_START = 2; // first visible row index

export type Board = number[][]; // [ROWS][COLS], 0=empty, 1-7=piece, 8=garbage

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

// ── Collision ─────────────────────────────────────────────────────────────────
export function isValid(board: Board, piece: ActivePiece): boolean {
  for (const [r, c] of boardCells(piece)) {
    if (c < 0 || c >= COLS || r >= ROWS) return false;
    if (r >= 0 && board[r][c] !== 0) return false;
  }
  return true;
}

export function isGrounded(board: Board, piece: ActivePiece): boolean {
  return !isValid(board, { ...piece, row: piece.row + 1 });
}


// Lock the piece to the board. Alters state of the board
export function lockPiece(board: Board, piece: ActivePiece): void {
  const value = PIECE_VALUE[piece.kind];
  for (const [r, c] of boardCells(piece)) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      board[r][c] = value;
    }
  }
}

/** Removes full rows, shifts remaining rows down. Returns lines cleared. */
export function clearLines(board: Board): number {
  const newBoard = emptyBoard();
  let write = ROWS - 1;
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].includes(0)) {
      newBoard[write--] = board[r];
    } else {
      cleared++;
    }
  }
  for (let r = 0; r < ROWS; r++) board[r] = newBoard[r];
  return cleared;
}

export function spawnPiece(board: Board, kind: PieceKind): ActivePiece {

  const piece: ActivePiece = {
    kind,
    row: VISIBLE_ROW_START - 2,
    col: spawnCol(kind),
    rotation: 0,

    isFloored: false,
    timeOnFloor: 0,

    highestRowIndex: VISIBLE_ROW_START - 2,
    totalResets: 0
  }

  return piece;
}

/** Shifts all rows up by `lines`, then fills the bottom `lines` rows with garbage (value 8) with a single gap column left empty. */
export function applyGarbageLines(board: Board, lines: number, gap: number): void {
  for (let r = 0; r < ROWS - lines; r++) {
    board[r] = board[r + lines];
  }
  for (let r = ROWS - lines; r < ROWS; r++) {
    board[r] = new Array(COLS).fill(8);
    board[r][gap] = 0;
  }
}

// ── Gravity ───────────────────────────────────────────────────────────────────

/** Returns the level (1-based) for a given total lines cleared. Every 10 lines = +1 level. */
export function levelFromLines(lines: number): number {
  return Math.min(Math.floor(lines / 10) + 1, 20);
}
// ── Ghost piece ───────────────────────────────────────────────────────────────

export function ghostPiece(board: Board, piece: ActivePiece): ActivePiece {
  const ghost = { ...piece };
  sonicDrop(board, ghost);
  return ghost;
}

// ── Visible board slice ───────────────────────────────────────────────────────

/** Returns only the 20 visible rows (strips the 2-row invisible buffer). */
export function visibleBoard(board: Board): number[][] {
  return board.slice(VISIBLE_ROW_START);
}
