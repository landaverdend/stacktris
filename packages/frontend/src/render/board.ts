import { ActivePiece } from '@stacktris/shared';

export const CELL_SIZE = 28;
const GAP = 2;
const COLS = 10;
const ROWS = 20;
const BUFFER_ROWS = 2; // invisible buffer rows stripped by visibleBoard()

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

// ── Thermal gradient for locked cells (EVA-style heat-map) ──────────────────
// Mirrors the position-analysis displays in NGE: red/orange at the top of the
// stack, green through the middle, cyan/blue near the floor.
const GRADIENT_STOPS: [number, number, number][] = [
  [220, 32,  16 ], // 0.00 — deep red
  [240, 128, 0  ], // 0.25 — orange
  [64,  208, 32 ], // 0.50 — green
  [0,   208, 192], // 0.75 — cyan
  [32,  48,  224], // 1.00 — blue
];

function thermalColor(row: number, alpha = 1): string {
  const t    = row / (ROWS - 1);
  const seg  = t * (GRADIENT_STOPS.length - 1);
  const i    = Math.min(Math.floor(seg), GRADIENT_STOPS.length - 2);
  const f    = seg - i;
  const [r1, g1, b1] = GRADIENT_STOPS[i];
  const [r2, g2, b2] = GRADIENT_STOPS[i + 1];
  const r = Math.round(r1 + (r2 - r1) * f);
  const g = Math.round(g1 + (g2 - g1) * f);
  const b = Math.round(b1 + (b2 - b1) * f);
  return alpha === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

const EMPTY_COLOR = '#111111';
const GHOST_ALPHA = 0.25;

export const CANVAS_WIDTH = COLS * CELL_SIZE;
export const CANVAS_HEIGHT = ROWS * CELL_SIZE;
export const OPPONENT_CELL_SIZE = 14;

export function renderBoard(
  ctx: CanvasRenderingContext2D,
  board: number[][],
  activePiece: ActivePiece | null,
  dimmed = false,
  pieceAlpha = 1,
  cellSize = CELL_SIZE,
): void {
  const w = COLS * cellSize;
  const h = ROWS * cellSize;
  ctx.clearRect(0, 0, w, h);

  if (dimmed) ctx.globalAlpha = 0.4;

  // ── Locked cells — thermal gradient by row, gray for garbage ──────────────
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const v = board[row]?.[col] ?? 0;
      ctx.fillStyle = v === 0 ? EMPTY_COLOR : v === 8 ? COLORS[8] : thermalColor(row);
      ctx.fillRect(col * cellSize + GAP, row * cellSize + GAP, cellSize - GAP * 2, cellSize - GAP * 2);
    }
  }

  if (activePiece) {
    const cells = pieceOffsets(activePiece);
    const visRow = activePiece.row - BUFFER_ROWS;

    // ── Ghost piece — thermal color at destination row ───────────────────────
    const ghostRow = ghostDrop(board, cells, visRow, activePiece.col);
    const drop = ghostRow - visRow;
    if (drop > 0) {
      const ghostAlpha = dimmed ? 0.1 : GHOST_ALPHA;
      for (const [dr, dc] of cells) {
        const r = visRow + drop + dr;
        const c = activePiece.col + dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        ctx.fillStyle = thermalColor(r, ghostAlpha);
        ctx.fillRect(c * cellSize + GAP, r * cellSize + GAP, cellSize - GAP * 2, cellSize - GAP * 2);
      }
      ctx.globalAlpha = dimmed ? 0.4 : 1;
    }

    // ── Active piece ─────────────────────────────────────────────────────────
    ctx.globalAlpha = dimmed ? 0.4 * pieceAlpha : pieceAlpha;
    ctx.fillStyle = COLORS[pieceColorIndex(activePiece.kind)];
    for (const [dr, dc] of cells) {
      const r = visRow + dr;
      const c = activePiece.col + dc;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      ctx.fillRect(c * cellSize + GAP, r * cellSize + GAP, cellSize - GAP * 2, cellSize - GAP * 2);
    }

  }

  ctx.globalAlpha = 1;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PIECES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
function pieceColorIndex(kind: string): number {
  return PIECES.indexOf(kind) + 1;
}

/**
 * Returns the (dRow, dCol) offsets for a piece's cells at a given rotation.
 */
function pieceOffsets(p: ActivePiece): [number, number][] {
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
