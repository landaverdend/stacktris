import { PieceSnapshot } from '../types';

const CELL_SIZE = 28;
const GAP = 2;
const COLS = 10;
const ROWS = 20;

// Index matches Piece enum on server: 0=empty, 1=I, 2=O, 3=T, 4=S, 5=Z, 6=J, 7=L, 8=garbage
const COLORS: readonly string[] = [
  '', // 0 - empty
  '#00f0f0', // 1 - I
  '#f0f000', // 2 - O
  '#a000f0', // 3 - T
  '#00f000', // 4 - S
  '#f00000', // 5 - Z
  '#0000f0', // 6 - J
  '#f0a000', // 7 - L
  '#888888', // 8 - garbage
];

const EMPTY_COLOR = '#111111';
const GHOST_ALPHA = 0.25;

export const CANVAS_WIDTH = COLS * CELL_SIZE;
export const CANVAS_HEIGHT = ROWS * CELL_SIZE;

export function renderBoard(
  ctx: CanvasRenderingContext2D,
  board: number[][],
  activePiece: PieceSnapshot | null,
  dimmed = false,
  pieceAlpha = 1,
): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (dimmed) ctx.globalAlpha = 0.4;

  // ── Locked cells ───────────────────────────────────────────────────────────
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const v = board[row]?.[col] ?? 0;
      ctx.fillStyle = v === 0 ? EMPTY_COLOR : COLORS[v];
      ctx.fillRect(col * CELL_SIZE + GAP, row * CELL_SIZE + GAP, CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2);
    }
  }

  if (activePiece) {
    const cells = pieceOffsets(activePiece);

    // ── Ghost piece ─────────────────────────────────────────────────────────
    const ghostRow = ghostDrop(board, cells, activePiece.row, activePiece.col);
    const drop = ghostRow - activePiece.row;
    if (drop > 0) {
      ctx.globalAlpha = dimmed ? 0.1 : GHOST_ALPHA;
      ctx.fillStyle = COLORS[pieceColorIndex(activePiece.kind)];
      for (const [dr, dc] of cells) {
        const r = activePiece.row + drop + dr;
        const c = activePiece.col + dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        ctx.fillRect(c * CELL_SIZE + GAP, r * CELL_SIZE + GAP, CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2);
      }
      ctx.globalAlpha = dimmed ? 0.4 : 1;
    }

    // ── Active piece ─────────────────────────────────────────────────────────
    ctx.globalAlpha = dimmed ? 0.4 * pieceAlpha : pieceAlpha;
    ctx.fillStyle = COLORS[pieceColorIndex(activePiece.kind)];
    for (const [dr, dc] of cells) {
      const r = activePiece.row + dr;
      const c = activePiece.col + dc;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      ctx.fillRect(c * CELL_SIZE + GAP, r * CELL_SIZE + GAP, CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2);
    }
  }

  ctx.globalAlpha = 1;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pieceColorIndex(kind: string): number {
  return ['I', 'O', 'T', 'S', 'Z', 'J', 'L'].indexOf(kind) + 1;
}

/**
 * Returns the (dRow, dCol) offsets for a piece's cells at a given rotation.
 * Mirrors the SHAPES table in the Rust backend's piece.rs.
 */
function pieceOffsets(p: PieceSnapshot): [number, number][] {
  const shapes: Record<string, [number, number][][]> = {
    I: [
      [
        [1, 0],
        [1, 1],
        [1, 2],
        [1, 3],
      ],
      [
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 2],
      ],
      [
        [2, 0],
        [2, 1],
        [2, 2],
        [2, 3],
      ],
      [
        [0, 1],
        [1, 1],
        [2, 1],
        [3, 1],
      ],
    ],
    O: [
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
    ],
    T: [
      [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
      [
        [0, 1],
        [1, 1],
        [1, 2],
        [2, 1],
      ],
      [
        [1, 0],
        [1, 1],
        [1, 2],
        [2, 1],
      ],
      [
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 1],
      ],
    ],
    S: [
      [
        [0, 1],
        [0, 2],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 1],
        [0, 2],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
      ],
    ],
    Z: [
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ],
      [
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 0],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ],
      [
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 0],
      ],
    ],
    J: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
      [
        [0, 1],
        [0, 2],
        [1, 1],
        [2, 1],
      ],
      [
        [1, 0],
        [1, 1],
        [1, 2],
        [2, 2],
      ],
      [
        [0, 1],
        [1, 1],
        [2, 0],
        [2, 1],
      ],
    ],
    L: [
      [
        [0, 2],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
      [
        [0, 1],
        [1, 1],
        [2, 1],
        [2, 2],
      ],
      [
        [1, 0],
        [1, 1],
        [1, 2],
        [2, 0],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
    ],
  };
  return shapes[p.kind]?.[p.rotation % 4] ?? [];
}

/** Finds the lowest valid row for the piece to drop to (ghost position). */
function ghostDrop(board: number[][], cells: [number, number][], pieceRow: number, pieceCol: number): number {
  let drop = 0;
  while (canPlace(board, cells, pieceRow, pieceCol, drop + 1)) drop++;
  return pieceRow + drop;
}

function canPlace(board: number[][], cells: [number, number][], pieceRow: number, pieceCol: number, dy: number): boolean {
  for (const [dr, dc] of cells) {
    const r = pieceRow + dr + dy;
    const c = pieceCol + dc;
    if (r >= ROWS || c < 0 || c >= COLS) return false;
    if (r >= 0 && (board[r]?.[c] ?? 0) !== 0) return false;
  }
  return true;
}
