export type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

// Cell value written to the board when a piece locks (0 = empty, 8 = garbage)
export const PIECE_VALUE: Record<PieceKind, number> = {
  I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7,
};

export const ALL_PIECES: PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export interface LockDelay {
  groundedSince: number; // ms timestamp when piece first became grounded
  moves: number;         // move/rotate resets used
}

export interface ActivePiece {
  kind: PieceKind;
  row: number;
  col: number;
  rotation: number; // 0-3

  // How many frames the piece has been on the floor.  
  isFloored: boolean;
  timeOnFloor: number;
  // The amount of times the lock delay has been reset
  totalResets: number;
}

// [piece][rotation] = four [dr, dc] offsets relative to anchor
const SHAPES: Record<PieceKind, [number, number][][]> = {
  I: [
    [[1, 0], [1, 1], [1, 2], [1, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 1], [1, 1], [2, 1], [3, 1]],
  ],
  O: [
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
  ],
  T: [
    [[0, 1], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 1]],
    [[0, 1], [1, 0], [1, 1], [2, 1]],
  ],
  S: [
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
  ],
  Z: [
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 1], [1, 0], [1, 1], [2, 0]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 1], [1, 0], [1, 1], [2, 0]],
  ],
  J: [
    [[0, 0], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 0], [2, 1]],
  ],
  L: [
    [[0, 2], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [1, 2], [2, 0]],
    [[0, 0], [0, 1], [1, 1], [2, 1]],
  ],
};

export function cells(kind: PieceKind, rotation: number): [number, number][] {
  return SHAPES[kind][rotation % 4];
}

export function boardCells(piece: ActivePiece): [number, number][] {
  return cells(piece.kind, piece.rotation).map(([dr, dc]) => [piece.row + dr, piece.col + dc]);
}

export function spawnCol(kind: PieceKind): number {
  return kind === 'O' ? 4 : 3;
}

// SRS wall-kick tables — (dc, dr) offsets, indexed by from_rotation
const JLSTZ_CW: [number, number][][] = [
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],  // 0→R
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],    // R→2
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],     // 2→L
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], // L→0
];
const JLSTZ_CCW: [number, number][][] = [
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],     // 0→L
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],    // R→0
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], // 2→R
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],// L→2
];
const I_CW: [number, number][][] = [
  [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],  // 0→R
  [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],  // R→2
  [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],  // 2→L
  [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],  // L→0
];
const I_CCW: [number, number][][] = [
  [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],  // 0→L
  [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],  // R→0
  [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],  // 2→R
  [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],  // L→2
];
const O_KICKS: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];

export function kickOffsets(kind: PieceKind, fromRotation: number, cw: boolean): [number, number][] {
  const i = fromRotation % 4;
  if (kind === 'O') return O_KICKS.map(k => [...k] as [number, number]);
  if (kind === 'I') return (cw ? I_CW : I_CCW)[i];
  return (cw ? JLSTZ_CW : JLSTZ_CCW)[i];
}

// ── 7-bag RNG (Mulberry32 PRNG) ───────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededPieceBag {
  private bag: PieceKind[] = [];
  private rng: () => number;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
  }

  next(): PieceKind {
    if (this.bag.length === 0) this.refill();
    return this.bag.pop()!;
  }

  private refill(): void {
    const arr: PieceKind[] = [...ALL_PIECES];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this.bag = arr;
  }
}
