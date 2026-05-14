import { InputAction } from '@stacktris/shared';
import { storage } from '../lib/storage';
import { IInputHandler } from './IInputHandler';

const DEFAULT_DAS_MS = 150;
const DEFAULT_ARR_MS = 16;
const AXIS_DEADZONE = 0.5;

const BUTTON_MAP: Partial<Record<number, InputAction>> = {
  0:  'hard_drop',   // A / Cross / B (Nintendo)
  1:  'rotate_cw',   // B / Circle / A (Nintendo)
  2:  'rotate_ccw',  // X / Square / Y (Nintendo)
  3:  'hold',        // Y / Triangle / X (Nintendo)
  4:  'hold',        // LB / L1 / L
  12: 'rotate_cw',   // D-pad up
  13: 'soft_drop',   // D-pad down
  14: 'move_left',   // D-pad left
  15: 'move_right',  // D-pad right
};

const AXIS_MAP: Array<[axisIdx: number, positive: boolean, action: InputAction]> = [
  [0, false, 'move_left'],
  [0, true,  'move_right'],
  [1, true,  'soft_drop'],
];

const REPEATABLE = new Set<InputAction>(['move_left', 'move_right', 'soft_drop']);

// Shared registry so multiple handlers don't claim the same physical gamepad.
const claimedIndices = new Set<number>();

interface HeldInput {
  action: InputAction;
  heldSince: number;
  lastRepeat: number | null;
}

export class GamepadInputHandler implements IInputHandler {
  private readonly onAction: (action: InputAction) => void;
  private readonly dasMs: number;
  private readonly arrMs: number;

  private active = false;
  private claimedIndex: number | null = null;
  private prevButtons: boolean[] = [];
  private prevAxisActive = new Map<string, boolean>();
  private held = new Map<string, HeldInput>();

  constructor(onAction: (action: InputAction) => void) {
    this.onAction = onAction;
    this.dasMs = storage.get('das_ms') || DEFAULT_DAS_MS;
    this.arrMs = storage.get('arr_ms');
  }

  attach(): void {
    this.active = true;
    this.prevButtons = [];
    this.prevAxisActive.clear();
    this.held.clear();
  }

  detach(): void {
    this.active = false;
    if (this.claimedIndex !== null) {
      claimedIndices.delete(this.claimedIndex);
      this.claimedIndex = null;
    }
    this.prevButtons = [];
    this.prevAxisActive.clear();
    this.held.clear();
  }

  tick(now: number): void {
    if (!this.active) return;

    // Claim the first available connected gamepad on first tick.
    if (this.claimedIndex === null) {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && !claimedIndices.has(i)) {
          this.claimedIndex = i;
          claimedIndices.add(i);
          break;
        }
      }
      if (this.claimedIndex === null) return;
    }

    const gp = navigator.getGamepads()[this.claimedIndex];
    if (!gp) return;

    // --- Buttons ---
    for (const [idxStr, action] of Object.entries(BUTTON_MAP) as Array<[string, InputAction]>) {
      const idx = Number(idxStr);
      const pressed = gp.buttons[idx]?.pressed ?? false;
      const was = this.prevButtons[idx] ?? false;
      const key = `btn-${idx}`;

      if (pressed && !was) {
        this.onAction(action);
        if (REPEATABLE.has(action))
          this.held.set(key, { action, heldSince: now, lastRepeat: null });
      } else if (!pressed && was) {
        this.held.delete(key);
      }
      this.prevButtons[idx] = pressed;
    }

    // --- Axes ---
    for (const [axisIdx, positive, action] of AXIS_MAP) {
      const value = gp.axes[axisIdx] ?? 0;
      const active = positive ? value > AXIS_DEADZONE : value < -AXIS_DEADZONE;
      const key = `axis-${axisIdx}-${positive ? 'pos' : 'neg'}`;
      const was = this.prevAxisActive.get(key) ?? false;

      if (active && !was) {
        this.onAction(action);
        if (REPEATABLE.has(action))
          this.held.set(key, { action, heldSince: now, lastRepeat: null });
      } else if (!active && was) {
        this.held.delete(key);
      }
      this.prevAxisActive.set(key, active);
    }

    // --- DAS / ARR ---
    for (const held of this.held.values()) {
      const elapsed = now - held.heldSince;
      if (elapsed < this.dasMs) continue;
      if (held.lastRepeat === null || this.arrMs === 0 || now - held.lastRepeat >= this.arrMs) {
        this.onAction(held.action);
        held.lastRepeat = now;
      }
    }
  }
}
