// Spring constants — tune these to adjust feel.
const STIFFNESS = 0.12;  // how strongly the board pulls back to rest
const DAMPING = 0.78;    // velocity multiplier per frame (lower = more oscillation)
const MAX_DISP = 14;     // hard clamp on displacement, px

interface Spring {
  x: number; y: number;
  vx: number; vy: number;
}

// Horizontal impulse magnitudes keyed by lines cleared (index = line count).
// Negative y = upward pop, matching the "lines vanish" feeling.
const LINE_CLEAR_IMPULSE: ReadonlyArray<[dx: number, dy: number]> = [
  [0, 0], // 0 lines — unused
  [0.5, -0.2], // single
  [0.9, -0.4], // double
  [1.4, -0.6], // triple
  [2.2, -1.0], // tetris
];

export class BoardShaker {
  private spring: Spring = { x: 0, y: 0, vx: 0, vy: 0 };

  constructor(private readonly el: HTMLElement) { }

  /** Add an instantaneous velocity kick in pixels/frame. */
  impulse(dx: number, dy: number): void {
    this.spring.vx += dx;
    this.spring.vy += dy;
  }

  /** Call once per visual frame (RAF). Advances the spring and writes transform. */
  tick(): void {
    const sp = this.spring;

    // Spring force toward origin, then damp
    sp.vx = (sp.vx - STIFFNESS * sp.x) * DAMPING;
    sp.vy = (sp.vy - STIFFNESS * sp.y) * DAMPING;

    sp.x = Math.max(-MAX_DISP, Math.min(MAX_DISP, sp.x + sp.vx));
    sp.y = Math.max(-MAX_DISP, Math.min(MAX_DISP, sp.y + sp.vy));

    this.el.style.transform = `translate(${sp.x.toFixed(2)}px,${sp.y.toFixed(2)}px)`;
  }

  /** Trigger a downward thud scaled by the number of rows the piece fell. */
  onHardDrop(rows: number): void {
    this.impulse(0, rows * 0.065);
  }

  /** Trigger a horizontal snap scaled by lines cleared. */
  onLinesCleared(lines: number): void {
    if (lines <= 0) return;
    const [dx, dy] = LINE_CLEAR_IMPULSE[Math.min(lines, 4)];
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.impulse(dir * dx, dy);
  }

  /** Reset transform and spring state. */
  destroy(): void {
    this.spring = { x: 0, y: 0, vx: 0, vy: 0 };
    this.el.style.transform = '';
  }
}
