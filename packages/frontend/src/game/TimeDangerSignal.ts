import type { IDangerSignal } from './DangerSignal';

const EPSILON = 0.002;

/**
 * Drives the shared background danger level from elapsed time rather than
 * board state. Used in split-screen so the ambient visuals (spinning grid,
 * telemetry columns) build tension as the round progresses, independent of
 * any single player's stack height.
 *
 * Ramps from 0 → maxDanger over durationMs using a gentle ease-in curve,
 * then holds at maxDanger. Call reset() at the start of each round.
 */
export class TimeDangerSignal implements IDangerSignal {
  private _value = 0;
  private listeners = new Set<(v: number) => void>();
  private startMs = 0;
  private rafId = 0;
  private readonly durationMs: number;
  private readonly maxDanger: number;

  constructor(durationMs = 150_000, maxDanger = 0.75) {
    this.durationMs = durationMs;
    this.maxDanger = maxDanger;
  }

  get value() { return this._value; }

  subscribe(fn: (v: number) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    this.startMs = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  reset(): void {
    cancelAnimationFrame(this.rafId);
    this.emit(0);
    this.start();
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  private emit(v: number): void {
    this._value = v;
    this.listeners.forEach(fn => fn(v));
  }

  private tick = (): void => {
    const elapsed = performance.now() - this.startMs;
    const t = Math.min(elapsed / this.durationMs, 1);
    const next = Math.pow(t, 0.65) * this.maxDanger;
    if (Math.abs(next - this._value) >= EPSILON) {
      this.emit(next);
    }
    this.rafId = requestAnimationFrame(this.tick);
  };
}
