import { InputAction } from '@stacktris/shared';

const DEFAULT_DAS_MS = 150; // Tetris guideline standard (10 frames @ 60fps)
const DEFAULT_ARR_MS = 16;  // 2 frames @ 60fps — smooth but not jarring

const KEY_MAP: Record<string, InputAction> = {
  ArrowLeft: 'move_left',
  ArrowRight: 'move_right',
  ArrowDown: 'soft_drop',
  ArrowUp: 'rotate_cw',
  z: 'rotate_ccw',
  Z: 'rotate_ccw',
  ' ': 'hard_drop',
  c: 'hold',
  C: 'hold',
  Shift: 'hold',
};

// Only these actions use DAS/ARR — others fire once on keydown
const REPEATABLE = new Set<InputAction>(['move_left', 'move_right', 'soft_drop']);

interface HeldKey {
  action: InputAction;
  heldSince: number;
  lastRepeat: number | null;
}

export class InputHandler {
  private onAction: (action: InputAction) => void;
  private held = new Map<string, HeldKey>();
  private bound = false;
  private dasMs: number;
  private arrMs: number;

  constructor(onAction: (action: InputAction) => void) {
    this.onAction = onAction;
    const das = Number(localStorage.getItem('das_ms'));
    const arr = Number(localStorage.getItem('arr_ms'));
    this.dasMs = Number.isFinite(das) && das > 0 ? das : DEFAULT_DAS_MS;
    this.arrMs = Number.isFinite(arr) && arr >= 0 ? arr : DEFAULT_ARR_MS;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  attach(): void {
    if (this.bound) return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.bound = true;
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.held.clear();
    this.bound = false;
  }

  /** Call once per RAF frame to fire DAS/ARR repeats. */
  tick(now: number): void {
    for (const [, held] of this.held) {
      if (!REPEATABLE.has(held.action)) continue;

      const elapsed = now - held.heldSince;
      if (elapsed < this.dasMs) continue;

      // DAS has triggered — start ARR
      if (held.lastRepeat === null || this.arrMs === 0 || now - held.lastRepeat >= this.arrMs) {
        this.onAction(held.action);
        held.lastRepeat = now;
      }
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    const action = KEY_MAP[e.key];
    if (!action) return;
    e.preventDefault();

    // Ignore browser key repeat — we handle our own
    if (e.repeat) return;

    this.onAction(action);

    if (REPEATABLE.has(action)) {
      this.held.set(e.key, { action, heldSince: performance.now(), lastRepeat: null });
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.held.delete(e.key);
  }
}
