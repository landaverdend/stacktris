import { describe, it, expect, vi } from 'vitest';
import { boardDangerLevel, DangerSignal, applyVignette, applyDangerBorder } from '../game/DangerSignal';
import type { Board } from '@stacktris/shared';

// Board dimensions — keep in sync with shared/src/game/state.ts
const COLS = 10;
const ROWS = 22;
const VISIBLE_ROW_START = 2; // rows 0-1 are the invisible buffer

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0)) as Board;
}

function boardWithPieceAtRow(row: number): Board {
  const b = emptyBoard();
  b[row][0] = 1;
  return b;
}

describe('boardDangerLevel', () => {
  it('returns 0 for an empty board', () => {
    expect(boardDangerLevel(emptyBoard())).toBe(0);
  });

  it('returns 1.0 when the stack reaches the top visible row', () => {
    expect(boardDangerLevel(boardWithPieceAtRow(VISIBLE_ROW_START))).toBe(1.0);
  });

  it('returns a mid-range value for a mid-height stack', () => {
    // Row at the midpoint of visible rows (row 12 = 10 rows from top)
    const danger = boardDangerLevel(boardWithPieceAtRow(12));
    expect(danger).toBeGreaterThan(0);
    expect(danger).toBeLessThan(1);
  });

  it('increases as the stack grows higher', () => {
    const low  = boardDangerLevel(boardWithPieceAtRow(18)); // near bottom
    const high = boardDangerLevel(boardWithPieceAtRow(4));  // near top
    expect(high).toBeGreaterThan(low);
  });

  it('only reads visible rows — buffer rows are ignored', () => {
    const b = emptyBoard();
    b[0][0] = 1; // row 0 is in the invisible buffer
    b[1][0] = 1; // row 1 is in the invisible buffer
    expect(boardDangerLevel(b)).toBe(0);
  });
});

describe('DangerSignal', () => {
  it('starts at 0', () => {
    const signal = new DangerSignal();
    expect(signal.value).toBe(0);
  });

  it('notifies subscribers when danger changes meaningfully', () => {
    const signal = new DangerSignal();
    const listener = vi.fn();
    signal.subscribe(listener);
    signal.update(boardWithPieceAtRow(VISIBLE_ROW_START)); // danger = 1.0
    expect(listener).toHaveBeenCalledWith(1.0);
  });

  it('does not notify when value changes by less than epsilon (0.005)', () => {
    const signal = new DangerSignal();
    // Prime the signal at a mid-level danger
    signal.update(boardWithPieceAtRow(12));
    const listener = vi.fn();
    signal.subscribe(listener);
    // Update with the exact same board — no change, no notification
    signal.update(boardWithPieceAtRow(12));
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function that stops notifications', () => {
    const signal = new DangerSignal();
    const listener = vi.fn();
    const unsub = signal.subscribe(listener);
    unsub();
    signal.update(boardWithPieceAtRow(VISIBLE_ROW_START));
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers independently', () => {
    const signal = new DangerSignal();
    const a = vi.fn();
    const b = vi.fn();
    signal.subscribe(a);
    const unsub = signal.subscribe(b);
    signal.update(boardWithPieceAtRow(VISIBLE_ROW_START));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsub();
    signal.update(emptyBoard()); // danger drops to 0 — a notified, b not
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe('applyVignette', () => {
  it('does nothing when el is null', () => {
    expect(() => applyVignette(null, 0.5)).not.toThrow();
  });

  it('clears styles below the vignette threshold (0.18)', () => {
    const el = document.createElement('div');
    el.style.boxShadow = 'some existing shadow';
    applyVignette(el, 0.1);
    expect(el.style.boxShadow).toBe('');
    expect(el.style.animation).toBe('');
  });

  it('sets a box shadow above the threshold', () => {
    const el = document.createElement('div');
    applyVignette(el, 0.9);
    expect(el.style.boxShadow).toContain('inset');
    expect(el.style.animation).toContain('vignette-breathe');
  });

  it('pulses faster (shorter duration) at higher danger', () => {
    const elLow  = document.createElement('div');
    const elHigh = document.createElement('div');
    applyVignette(elLow,  0.3);
    applyVignette(elHigh, 0.95);
    const durationLow  = parseFloat(elLow.style.animation.split(' ')[1]);
    const durationHigh = parseFloat(elHigh.style.animation.split(' ')[1]);
    expect(durationHigh).toBeLessThan(durationLow);
  });
});

describe('applyDangerBorder', () => {
  it('does nothing when el is null', () => {
    expect(() => applyDangerBorder(null, 0.5)).not.toThrow();
  });

  it('removes CSS vars below threshold (0.12)', () => {
    const el = document.createElement('div');
    el.style.setProperty('--nb-color', 'red');
    applyDangerBorder(el, 0.05);
    expect(el.style.getPropertyValue('--nb-color')).toBe('');
  });

  it('sets CSS vars above threshold', () => {
    const el = document.createElement('div');
    applyDangerBorder(el, 0.8);
    expect(el.style.getPropertyValue('--nb-color')).not.toBe('');
    expect(el.style.getPropertyValue('--nb-glow')).not.toBe('');
  });
});
