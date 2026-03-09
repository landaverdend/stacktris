import { InputAction } from '@stacktris/shared';

const DAS_MS = 133;
const ARR_MS = 16; // ~1 frame at 60fps

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

  constructor(onAction: (action: InputAction) => void) {
    this.onAction = onAction;
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
      if (elapsed < DAS_MS) continue;

      // DAS has triggered — start ARR
      if (held.lastRepeat === null || now - held.lastRepeat >= ARR_MS) {
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
