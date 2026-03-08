const CELL = 20;
const COLS = 4;
const ROWS_PER_PIECE = 4;
const GAP = 6;
export const PREVIEW_COUNT = 5;

export const QUEUE_WIDTH = COLS * CELL;
export const QUEUE_HEIGHT = PREVIEW_COUNT * (ROWS_PER_PIECE * CELL) + (PREVIEW_COUNT - 1) * GAP;

// Index matches Piece enum: 0=empty, 1=I … 7=L
const COLORS: readonly string[] = [
  '',
  '#00f0f0', // I
  '#f0f000', // O
  '#a000f0', // T
  '#00f000', // S
  '#f00000', // Z
  '#0000f0', // J
  '#f0a000', // L
];

// Rotation-0 offsets only — enough for static preview.
const ROT0: Record<string, [number, number][]> = {
  I: [[1, 0], [1, 1], [1, 2], [1, 3]],
  O: [[0, 0], [0, 1], [1, 0], [1, 1]],
  T: [[0, 1], [1, 0], [1, 1], [1, 2]],
  S: [[0, 1], [0, 2], [1, 0], [1, 1]],
  Z: [[0, 0], [0, 1], [1, 1], [1, 2]],
  J: [[0, 0], [1, 0], [1, 1], [1, 2]],
  L: [[0, 2], [1, 0], [1, 1], [1, 2]],
};

const KIND_INDEX: Record<string, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };

export function renderQueue(ctx: CanvasRenderingContext2D, nextPieces: string[]): void {
  ctx.clearRect(0, 0, QUEUE_WIDTH, QUEUE_HEIGHT);

  for (let n = 0; n < PREVIEW_COUNT; n++) {
    const kind = nextPieces[n];
    if (!kind) continue;

    const slotTop = n * (ROWS_PER_PIECE * CELL + GAP);
    const cells = ROT0[kind] ?? [];
    const color = COLORS[KIND_INDEX[kind] ?? 0];
    if (!color) continue;

    ctx.fillStyle = color;
    for (const [dr, dc] of cells) {
      ctx.fillRect(
        dc * CELL + 1,
        slotTop + dr * CELL + 1,
        CELL - 2,
        CELL - 2,
      );
    }
  }
}
