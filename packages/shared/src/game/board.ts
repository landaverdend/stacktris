import { ActivePiece, PieceKind, PIECE_VALUE, boardCells, cells, kickOffsets, spawnCol } from './pieces.js';

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

// ── Movement ──────────────────────────────────────────────────────────────────

export function tryMoveDown(board: Board, piece: ActivePiece): ActivePiece | null {
  const moved = { ...piece, row: piece.row + 1 };
  return isValid(board, moved) ? moved : null;
}

export function tryMoveLeft(board: Board, piece: ActivePiece): ActivePiece | null {
  const moved = { ...piece, col: piece.col - 1 };
  return isValid(board, moved) ? moved : null;
}

export function tryMoveRight(board: Board, piece: ActivePiece): ActivePiece | null {
  const moved = { ...piece, col: piece.col + 1 };
  return isValid(board, moved) ? moved : null;
}

export function tryRotate(board: Board, piece: ActivePiece, cw: boolean): ActivePiece | null {
  const nextRot = ((piece.rotation + (cw ? 1 : 3)) % 4) as number;
  const kicks = kickOffsets(piece.kind, piece.rotation, cw);
  for (const [dc, dr] of kicks) {
    const candidate = { ...piece, rotation: nextRot, row: piece.row + dr, col: piece.col + dc };
    if (isValid(board, candidate)) return candidate;
  }
  return null;
}

export function sonicDrop(board: Board, piece: ActivePiece): ActivePiece {
  let p = piece;
  let next: ActivePiece | null;
  while ((next = tryMoveDown(board, p)) !== null) p = next;
  return p;
}

// ── Locking & clearing ────────────────────────────────────────────────────────

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

// ── Spawn ─────────────────────────────────────────────────────────────────────

/** Spawns a piece at the standard position. Returns null if blocked (top-out). */
export function spawnPiece(board: Board, kind: PieceKind): ActivePiece | null {
  const piece: ActivePiece = {
    kind,
    row: VISIBLE_ROW_START - 2, // row 0, in the invisible buffer
    col: spawnCol(kind),
    rotation: 0,
  };
  return isValid(board, piece) ? piece : null;
}

// ── Gravity ───────────────────────────────────────────────────────────────────

/** Returns the level (1-based) for a given total lines cleared. Every 10 lines = +1 level. */
export function levelFromLines(lines: number): number {
  return Math.min(Math.floor(lines / 10) + 1, 20);
}

/** Returns the gravity tick interval in ms for a given level (Marathon formula). */
export function gravityTickMs(level: number): number {
  const l = level - 1;
  const ms = Math.pow(0.8 - l * 0.007, l) * 1000;
  return Math.max(ms, 33);
}

// ── Ghost piece ───────────────────────────────────────────────────────────────

export function ghostPiece(board: Board, piece: ActivePiece): ActivePiece {
  return sonicDrop(board, piece);
}

// ── Visible board slice ───────────────────────────────────────────────────────

/** Returns only the 20 visible rows (strips the 2-row invisible buffer). */
export function visibleBoard(board: Board): number[][] {
  return board.slice(VISIBLE_ROW_START);
}

/**
 * Returns a 32-bit integer checksum of the locked board state.
 * Used to validate client board state against the server shadow at piece lock boundaries.
 * The active piece is NOT included — pass the board after the piece has been locked.
 */
export function boardChecksum(board: Board): number {
  let h = 0x811c9dc5; // FNV-1a offset basis
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      h ^= board[r][c];
      h = (Math.imul(h, 0x01000193) >>> 0); // FNV prime, keep as unsigned 32-bit
    }
  }
  return h >>> 0;
}
