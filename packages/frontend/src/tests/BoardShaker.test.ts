import { describe, it, expect, beforeEach } from 'vitest';
import { BoardShaker } from '../game/BoardShaker';

const MAX_DISP = 14;

function makeShaker() {
  const el = document.createElement('div');
  return { el, shaker: new BoardShaker(el) };
}

describe('BoardShaker', () => {
  describe('initial state', () => {
    it('starts with no transform', () => {
      const { el } = makeShaker();
      expect(el.style.transform).toBe('');
    });
  });

  describe('impulse', () => {
    it('a single tick after an impulse moves the element', () => {
      const { el, shaker } = makeShaker();
      shaker.impulse(5, 0);
      shaker.tick();
      expect(el.style.transform).not.toBe('translate(0.00px,0.00px)');
      expect(el.style.transform).toContain('px');
    });

    it('accumulates multiple impulses', () => {
      const { shaker } = makeShaker();
      shaker.impulse(2, 0);
      shaker.impulse(2, 0);
      // internal vx should be 4 — we verify indirectly via displacement after tick
      const el2 = document.createElement('div');
      const single = new BoardShaker(el2);
      single.impulse(4, 0);

      shaker.tick();
      single.tick();
      expect(shaker['spring'].x).toBeCloseTo(single['spring'].x, 5);
    });
  });

  describe('spring decay', () => {
    it('displacement returns toward zero over many ticks', () => {
      const { el, shaker } = makeShaker();
      shaker.impulse(MAX_DISP, 0);
      for (let i = 0; i < 5; i++) shaker.tick();
      const midX = shaker['spring'].x;

      for (let i = 0; i < 60; i++) shaker.tick();
      expect(Math.abs(shaker['spring'].x)).toBeLessThan(Math.abs(midX));
    });
  });

  describe('displacement clamping', () => {
    it('never exceeds MAX_DISP regardless of impulse size', () => {
      const { shaker } = makeShaker();
      shaker.impulse(1000, 1000);
      for (let i = 0; i < 10; i++) shaker.tick();
      expect(Math.abs(shaker['spring'].x)).toBeLessThanOrEqual(MAX_DISP);
      expect(Math.abs(shaker['spring'].y)).toBeLessThanOrEqual(MAX_DISP);
    });
  });

  describe('onHardDrop', () => {
    it('applies a downward impulse proportional to rows fallen', () => {
      const { shaker: s1 } = makeShaker();
      const { shaker: s2 } = makeShaker();
      s1.onHardDrop(4);
      s2.onHardDrop(8);
      // 8 row drop should produce double the vy of a 4 row drop
      expect(s2['spring'].vy).toBeCloseTo(s1['spring'].vy * 2, 5);
    });

    it('does not add horizontal displacement', () => {
      const { shaker } = makeShaker();
      shaker.onHardDrop(10);
      expect(shaker['spring'].vx).toBe(0);
    });
  });

  describe('onLinesCleared', () => {
    it('does nothing for 0 lines', () => {
      const { shaker } = makeShaker();
      shaker.onLinesCleared(0);
      expect(shaker['spring'].vx).toBe(0);
      expect(shaker['spring'].vy).toBe(0);
    });

    it('applies a larger impulse for a tetris than a single', () => {
      const { shaker: s1 } = makeShaker();
      const { shaker: s4 } = makeShaker();
      s1.onLinesCleared(1);
      s4.onLinesCleared(4);
      const mag1 = Math.hypot(s1['spring'].vx, s1['spring'].vy);
      const mag4 = Math.hypot(s4['spring'].vx, s4['spring'].vy);
      expect(mag4).toBeGreaterThan(mag1);
    });

    it('clamps line count at 4', () => {
      // clearing 5 lines (impossible normally) should behave same as 4
      const { shaker: s4 } = makeShaker();
      const { shaker: s5 } = makeShaker();
      s4.onLinesCleared(4);
      s5.onLinesCleared(5);
      expect(Math.abs(s5['spring'].vx)).toBeCloseTo(Math.abs(s4['spring'].vx), 5);
    });
  });

  describe('destroy', () => {
    it('resets spring state and clears transform', () => {
      const { el, shaker } = makeShaker();
      shaker.impulse(10, 10);
      shaker.tick();
      shaker.destroy();
      expect(shaker['spring']).toEqual({ x: 0, y: 0, vx: 0, vy: 0 });
      expect(el.style.transform).toBe('');
    });
  });
});
