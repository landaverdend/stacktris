import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputHandler } from '../game/InputHandler';

function fireKeyDown(key: string, repeat = false) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, repeat }));
}

function fireKeyUp(key: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}

describe('InputHandler', () => {
  let handler: InputHandler;
  let actions: string[];

  beforeEach(() => {
    localStorage.clear();
    actions = [];
    handler = new InputHandler(a => actions.push(a));
    handler.attach();
  });

  afterEach(() => {
    handler.detach();
  });

  describe('key mapping', () => {
    it('fires move_left on ArrowLeft', () => {
      fireKeyDown('ArrowLeft');
      expect(actions).toContain('move_left');
    });

    it('fires move_right on ArrowRight', () => {
      fireKeyDown('ArrowRight');
      expect(actions).toContain('move_right');
    });

    it('fires hard_drop on Space', () => {
      fireKeyDown(' ');
      expect(actions).toContain('hard_drop');
    });

    it('fires rotate_cw on ArrowUp', () => {
      fireKeyDown('ArrowUp');
      expect(actions).toContain('rotate_cw');
    });

    it('fires rotate_ccw on z and Z', () => {
      fireKeyDown('z');
      fireKeyDown('Z');
      expect(actions.filter(a => a === 'rotate_ccw')).toHaveLength(2);
    });

    it('fires hold on c, C, and Shift', () => {
      fireKeyDown('c');
      fireKeyDown('C');
      fireKeyDown('Shift');
      expect(actions.filter(a => a === 'hold')).toHaveLength(3);
    });

    it('ignores unmapped keys', () => {
      fireKeyDown('q');
      fireKeyDown('Enter');
      expect(actions).toHaveLength(0);
    });
  });

  describe('browser repeat suppression', () => {
    it('ignores keydown events with repeat=true', () => {
      fireKeyDown('ArrowLeft');          // first press — fire
      fireKeyDown('ArrowLeft', true);    // browser repeat — ignore
      fireKeyDown('ArrowLeft', true);    // browser repeat — ignore
      expect(actions.filter(a => a === 'move_left')).toHaveLength(1);
    });
  });

  describe('non-repeatable actions', () => {
    it('hard_drop fires once and does not enter held map', () => {
      fireKeyDown(' ');
      // tick well past any DAS — should not produce additional actions
      const before = actions.length;
      handler.tick(performance.now() + 1000);
      expect(actions.length).toBe(before);
    });

    it('rotate_cw fires once per keydown', () => {
      fireKeyDown('ArrowUp');
      handler.tick(performance.now() + 1000);
      expect(actions.filter(a => a === 'rotate_cw')).toHaveLength(1);
    });
  });

  describe('DAS / ARR', () => {
    it('does not repeat a held key before DAS expires', () => {
      fireKeyDown('ArrowLeft');
      const start = performance.now();
      handler.tick(start + 50); // well before default DAS of 150ms
      expect(actions.filter(a => a === 'move_left')).toHaveLength(1); // only the initial press
    });

    it('fires again after DAS threshold', () => {
      fireKeyDown('ArrowLeft');
      const start = performance.now();
      handler.tick(start + 200); // past default DAS of 150ms
      expect(actions.filter(a => a === 'move_left').length).toBeGreaterThanOrEqual(2);
    });

    it('fires continuously under ARR after DAS', () => {
      fireKeyDown('ArrowRight');
      const start = performance.now();
      handler.tick(start + 200); // trigger DAS
      handler.tick(start + 220); // one ARR tick
      handler.tick(start + 240); // another ARR tick
      expect(actions.filter(a => a === 'move_right').length).toBeGreaterThanOrEqual(3);
    });

    it('respects custom DAS from localStorage', () => {
      handler.detach();
      localStorage.setItem('das_ms', '50');
      actions = [];
      const customHandler = new InputHandler(a => actions.push(a));
      customHandler.attach();
      try {
        fireKeyDown('ArrowLeft');
        const start = performance.now();
        customHandler.tick(start + 80); // past custom DAS of 50ms
        expect(actions.filter(a => a === 'move_left').length).toBeGreaterThanOrEqual(2);
      } finally {
        customHandler.detach();
      }
    });
  });

  describe('key release', () => {
    it('stops repeating after keyup', () => {
      fireKeyDown('ArrowLeft');
      fireKeyUp('ArrowLeft');
      const before = actions.length;
      handler.tick(performance.now() + 500);
      expect(actions.length).toBe(before); // no new actions after release
    });
  });

  describe('detach', () => {
    it('stops responding to keydown after detach', () => {
      handler.detach();
      fireKeyDown('ArrowLeft');
      expect(actions).toHaveLength(0);
    });
  });
});
