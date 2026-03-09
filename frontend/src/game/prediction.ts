import { GameAction, PieceSnapshot } from '../types';

// ── Shape tables (exact copy of server piece.rs SHAPES) ───────────────────────
// Format: SHAPES[pieceIndex][rotation] = [(dr, dc), ...]
// Piece order matches server enum: I=0 O=1 T=2 S=3 Z=4 J=5 L=6
const SHAPES: [number, number][][][] = [
  // I
  [
    [[1,0],[1,1],[1,2],[1,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,1],[1,1],[2,1],[3,1]],
  ],
  // O
  [
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
  ],
  // T
  [
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,0],[1,1],[2,1]],
  ],
  // S
  [
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]],
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]],
  ],
  // Z
  [
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[1,0],[1,1],[2,0]],
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[1,0],[1,1],[2,0]],
  ],
  // J
  [
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,0],[2,1]],
  ],
  // L
  [
    [[0,2],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[1,2],[2,0]],
    [[0,0],[0,1],[1,1],[2,1]],
  ],
];

// ── SRS kick tables (exact copy of server piece.rs) ───────────────────────────
// Format: kicks[from_rotation] = [(dc, dr), ...] — note dc first, then dr
const JLSTZ_CW: [number, number][][] = [
  [[ 0, 0],[-1, 0],[-1,-1],[ 0, 2],[-1, 2]], // 0→R
  [[ 0, 0],[ 1, 0],[ 1, 1],[ 0,-2],[ 1,-2]], // R→2
  [[ 0, 0],[ 1, 0],[ 1,-1],[ 0, 2],[ 1, 2]], // 2→L
  [[ 0, 0],[-1, 0],[-1, 1],[ 0,-2],[-1,-2]], // L→0
];
const JLSTZ_CCW: [number, number][][] = [
  [[ 0, 0],[ 1, 0],[ 1,-1],[ 0, 2],[ 1, 2]], // 0→L
  [[ 0, 0],[ 1, 0],[ 1, 1],[ 0,-2],[ 1,-2]], // R→0
  [[ 0, 0],[-1, 0],[-1,-1],[ 0, 2],[-1, 2]], // 2→R
  [[ 0, 0],[-1, 0],[-1, 1],[ 0,-2],[-1,-2]], // L→2
];
const I_CW: [number, number][][] = [
  [[ 0, 0],[-2, 0],[ 1, 0],[-2, 1],[ 1,-2]], // 0→R
  [[ 0, 0],[-1, 0],[ 2, 0],[-1,-2],[ 2, 1]], // R→2
  [[ 0, 0],[ 2, 0],[-1, 0],[ 2,-1],[-1, 2]], // 2→L
  [[ 0, 0],[ 1, 0],[-2, 0],[ 1, 2],[-2,-1]], // L→0
];
const I_CCW: [number, number][][] = [
  [[ 0, 0],[-1, 0],[ 2, 0],[-1,-2],[ 2, 1]], // 0→L
  [[ 0, 0],[ 2, 0],[-1, 0],[ 2,-1],[-1, 2]], // R→0
  [[ 0, 0],[ 1, 0],[-2, 0],[ 1, 2],[-2,-1]], // 2→R
  [[ 0, 0],[-2, 0],[ 1, 0],[-2, 1],[ 1,-2]], // L→2
];
const O_KICKS: [number, number][][] = [
  [[0,0],[0,0],[0,0],[0,0],[0,0]],
  [[0,0],[0,0],[0,0],[0,0],[0,0]],
  [[0,0],[0,0],[0,0],[0,0],[0,0]],
  [[0,0],[0,0],[0,0],[0,0],[0,0]],
];

const PIECE_IDX: Record<string, number> = { I:0, O:1, T:2, S:3, Z:4, J:5, L:6 };
const BOARD_ROWS = 20;
const BOARD_COLS = 10;

function pieceCells(kind: string, rotation: number): [number, number][] {
  return SHAPES[PIECE_IDX[kind] ?? 0][rotation % 4];
}

function kicks(kind: string, fromRot: number, cw: boolean): [number, number][] {
  const i = fromRot % 4;
  if (kind === 'O') return O_KICKS[i];
  if (kind === 'I') return cw ? I_CW[i] : I_CCW[i];
  return cw ? JLSTZ_CW[i] : JLSTZ_CCW[i];
}

function valid(board: number[][], row: number, col: number, kind: string, rotation: number): boolean {
  for (const [dr, dc] of pieceCells(kind, rotation)) {
    const r = row + dr;
    const c = col + dc;
    if (c < 0 || c >= BOARD_COLS || r >= BOARD_ROWS) return false;
    if (r >= 0 && board[r][c] !== 0) return false;
  }
  return true;
}

/** Predict the result of a game action locally, without waiting for the server. */
export function predictMove(
  board: number[][],
  piece: PieceSnapshot,
  action: GameAction,
): PieceSnapshot {
  const { kind, row, col, rotation } = piece;

  switch (action.type) {
    case 'move_left': {
      const nc = col - 1;
      return valid(board, row, nc, kind, rotation) ? { ...piece, col: nc } : piece;
    }
    case 'move_right': {
      const nc = col + 1;
      return valid(board, row, nc, kind, rotation) ? { ...piece, col: nc } : piece;
    }
    case 'soft_drop': {
      const nr = row + 1;
      return valid(board, nr, col, kind, rotation) ? { ...piece, row: nr } : piece;
    }
    case 'rotate_cw': {
      const nr = (rotation + 1) % 4;
      for (const [dc, dr] of kicks(kind, rotation, true)) {
        if (valid(board, row + dr, col + dc, kind, nr)) {
          return { ...piece, row: row + dr, col: col + dc, rotation: nr };
        }
      }
      return piece;
    }
    case 'rotate_ccw': {
      const nr = (rotation + 3) % 4;
      for (const [dc, dr] of kicks(kind, rotation, false)) {
        if (valid(board, row + dr, col + dc, kind, nr)) {
          return { ...piece, row: row + dr, col: col + dc, rotation: nr };
        }
      }
      return piece;
    }
    // hard_drop and hold change the board/active piece type — let server handle
    default:
      return piece;
  }
}
