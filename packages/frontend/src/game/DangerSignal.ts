import { Board, ROWS, VISIBLE_ROW_START } from '@stacktris/shared';

const VISIBLE_ROWS = ROWS - VISIBLE_ROW_START;
const EPSILON = 0.005; // skip notifications for imperceptible changes

// ── Color palette ─────────────────────────────────────────────────────────────
// RGB channels only — no hardcoded hex strings in logic. Keep in sync with the
// CSS token values in index.css @theme.
type RGB = { r: number; g: number; b: number };

const COLOR: Record<string, RGB> = {
  bitcoin: { r: 247, g: 147, b: 26  }, // --color-bitcoin
  alert:   { r: 204, g: 34,  b: 0   }, // --color-alert
  danger:  { r: 180, g: 0,   b: 0   }, // deep red for vignette glow
};

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function rgba(c: RGB, alpha: number): string {
  return `rgba(${c.r},${c.g},${c.b},${alpha.toFixed(3)})`;
}

// ── Thresholds ────────────────────────────────────────────────────────────────
const VIGNETTE_THRESHOLD = 0.30; // danger level at which vignette begins
const BORDER_THRESHOLD   = 0.20; // border shifts earlier for a gradual transition

// ── Danger level computation ──────────────────────────────────────────────────

/**
 * Computes a danger level from 0.0 (empty board) to 1.0 (stack at the ceiling).
 * Uses stack height with a power curve so the upper third feels appropriately urgent.
 */
export function boardDangerLevel(board: Board): number {
  for (let r = VISIBLE_ROW_START; r < ROWS; r++) {
    if (board[r].some(cell => cell !== 0)) {
      const rowsFromTop = r - VISIBLE_ROW_START;
      const raw = 1 - rowsFromTop / VISIBLE_ROWS;
      return Math.pow(raw, 1.8);
    }
  }
  return 0;
}

// ── DOM effect functions ──────────────────────────────────────────────────────
// These write directly to DOM elements — no React state, no re-renders.
// Call them from a DangerSignal subscriber.

/**
 * Applies an inset vignette glow to a dedicated overlay div and animates it
 * with a slow breathing pulse that speeds up as danger increases.
 */
export function applyVignette(el: HTMLElement | null, danger: number): void {
  if (!el) return;

  if (danger < VIGNETTE_THRESHOLD) {
    el.style.boxShadow = '';
    el.style.animation = '';
    return;
  }

  const t = (danger - VIGNETTE_THRESHOLD) / (1 - VIGNETTE_THRESHOLD);
  const alpha  = Math.pow(t, 1.5) * 0.75;
  const spread = 30 + t * 52; // 30px → 82px

  el.style.boxShadow = `inset 0 0 ${spread.toFixed(1)}px ${rgba(COLOR.danger, alpha)}`;

  // Pulse: 2.2s when first entering danger zone → 0.55s when critical
  const duration = (2.2 - Math.pow(t, 0.8) * 1.65).toFixed(2);
  el.style.animation = `vignette-breathe ${duration}s ease-in-out infinite`;
}

// Shared color computation — returns null when below the threshold (safe state).
function dangerBorderColor(danger: number): RGB | null {
  if (danger < BORDER_THRESHOLD) return null;
  const t = (danger - BORDER_THRESHOLD) / (1 - BORDER_THRESHOLD);
  return lerpRGB(COLOR.bitcoin, COLOR.alert, Math.pow(t, 1.2));
}

/**
 * Shifts the nerv-border color (via CSS custom properties) from bitcoin-orange
 * toward alert-red. Use this on elements that have the nerv-border class.
 */
export function applyDangerBorder(el: HTMLElement | null, danger: number): void {
  if (!el) return;
  const c = dangerBorderColor(danger);
  if (!c) {
    el.style.removeProperty('--nb-color');
    el.style.removeProperty('--nb-glow');
    return;
  }
  el.style.setProperty('--nb-color', rgba(c, 0.85));
  el.style.setProperty('--nb-glow',  rgba(c, 0.40));
}

/**
 * Same color shift for plain bordered elements (e.g. opponent boards) that
 * don't use nerv-border. Writes directly to borderColor.
 */
export function applyDangerBorderSimple(el: HTMLElement | null, danger: number): void {
  if (!el) return;
  const c = dangerBorderColor(danger);
  el.style.borderColor = c ? rgba(c, 0.85) : '';
}

// ── Signal ────────────────────────────────────────────────────────────────────

type Listener = (value: number) => void;

/**
 * A minimal observable that holds the current danger level and notifies
 * subscribers when it changes meaningfully. Lives on the game instance so
 * any number of consumers can subscribe without the game knowing about them.
 */
export class DangerSignal {
  private _value = 0;
  private listeners = new Set<Listener>();

  get value(): number { return this._value; }

  /** Called by the game's RAF loop every frame. */
  update(board: Board): void {
    const next = boardDangerLevel(board);
    if (Math.abs(next - this._value) < EPSILON) return;
    this._value = next;
    this.listeners.forEach(fn => fn(next));
  }

  /** Returns an unsubscribe function. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
