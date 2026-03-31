/**
 * Regression tests for the garbage-cancellation race condition.
 *
 * Root cause (from debug_logs/Logs-logs-2026-03-30 21_14_53.txt):
 *   - At frame ~1500, client had pendingGarbage=[{lines:4,triggerFrame:1631,gap:7}]
 *     while the server had pendingGarbage=[].
 *   - What happened: the server routed 4L of garbage to the target player, then
 *     immediately cancelled it when that player's line-clear inputs arrived — but
 *     the old `game_garbage_incoming` protocol only fired on *add*, never on cancel.
 *     The client applied ghost garbage at triggerFrame 1631 → board shifted up →
 *     bag position drifted by 1 → cascading desync.
 *
 * The fix: replace `game_garbage_incoming` with `garbage_queue_sync`, which sends
 * the full PendingGarbage[] on every queue mutation (add OR cancel).  The client
 * replaces its queue wholesale via `syncGarbageQueue`, which now calls
 * `setPendingGarbage` so that the `pendingGarbage` event fires and the UI ref
 * stays current.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GameEngine, GARBAGE_DELAY_FRAMES } from '@stacktris/shared';
import { ServerMsg } from '@stacktris/shared';

// ── Mock PlayerGame (mirrors round.test.ts) ────────────────────────────────────

type SendMock = Mock<(msg: ServerMsg) => void>;
type Handler = (val?: any) => void;

class MockPlayerGame {
  static instances: MockPlayerGame[] = [];

  frameCount = 0;
  private handlers = new Map<string, Set<Handler>>();

  constructor(_seed: number) {
    MockPlayerGame.instances.push(this);
  }

  subscribe(event: string, fn: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return () => this.handlers.get(event)?.delete(fn);
  }

  emit(event: string, val?: any) {
    this.handlers.get(event)?.forEach(fn => fn(val));
  }

  addGarbage = vi.fn((lines: number, frame: number) => {
    this.emit('pendingGarbage', [{ lines, triggerFrame: frame + GARBAGE_DELAY_FRAMES, gap: 0 }]);
  });
  handleInput = vi.fn();
  tickTo = vi.fn();
  toGameFrame = vi.fn(() => ({
    board: [], activePiece: null, holdPiece: null, holdUsed: false,
    isGameOver: false, gravityLevel: 0.02, pendingGarbage: [], bagPosition: 0, frame: 0,
  }));
}

vi.mock('../src/game/playerGame.js', () => ({ PlayerGame: MockPlayerGame }));
const { Round } = await import('../src/game/round.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSend(): SendMock { return vi.fn(); }

function makeSlots(ids: string[]) {
  const sends: Record<string, SendMock> = {};
  const slots = ids.map((id, index) => {
    sends[id] = makeSend();
    return { playerId: id, playerName: id, lightningAddress: '', sendFn: sends[id], ready: true, paid: true, slotIndex: index };
  });
  return { slots, sends };
}

/** All garbage_queue_sync messages received by a send fn. */
function garbageSyncs(send: SendMock) {
  return send.mock.calls
    .map(([msg]) => msg)
    .filter(msg => msg.type === 'garbage_queue_sync') as { type: 'garbage_queue_sync'; queue: { lines: number; triggerFrame: number; gap: number }[] }[];
}

// ── Round-level regression ─────────────────────────────────────────────────────

describe('garbage_queue_sync — server notifies client of every queue change', () => {
  beforeEach(() => {
    MockPlayerGame.instances = [];
    vi.clearAllMocks();
  });

  it('sends garbage_queue_sync with the incoming queue when garbage is added', () => {
    const { slots, sends } = makeSlots(['p1', 'p2']);
    new Round(slots);
    const [pg1] = MockPlayerGame.instances;

    pg1.emit('attack', 4);

    const syncs = garbageSyncs(sends['p2']);
    expect(syncs).toHaveLength(1);
    expect(syncs[0].queue).toHaveLength(1);
    expect(syncs[0].queue[0].lines).toBe(4);
  });

  it('sends garbage_queue_sync with the updated queue when garbage is cancelled', () => {
    // This is the missing notification from the original bug: the cancel was never sent.
    const { slots, sends } = makeSlots(['p1', 'p2']);
    new Round(slots);
    const [pg1, pg2] = MockPlayerGame.instances;

    pg1.emit('attack', 4);   // add
    vi.clearAllMocks();

    pg2.emit('pendingGarbage', []); // cancel (engine emits this on line-clear)

    const syncs = garbageSyncs(sends['p2']);
    expect(syncs).toHaveLength(1);
    expect(syncs[0].queue).toHaveLength(0);
  });

  it('add → cancel: client ends up with an empty queue, not ghost garbage', () => {
    // Reproduces the exact log evidence:
    //   frame ~1500: client=[{lines:4,triggerFrame:1631}], server=[]
    // After the fix, the client receives a cancel sync and ends up with [].
    const { slots, sends } = makeSlots(['p1', 'p2']);
    new Round(slots);
    const [pg1, pg2] = MockPlayerGame.instances;

    pg1.emit('attack', 4);          // p1 attacks p2 → p2 queue grows
    pg2.emit('pendingGarbage', []); // p2's line-clear arrives, server cancels

    const syncs = garbageSyncs(sends['p2']);
    expect(syncs).toHaveLength(2);

    // First sync: garbage added
    expect(syncs[0].queue[0].lines).toBe(4);

    // Second sync (the previously missing cancel): queue empty
    expect(syncs[1].queue).toHaveLength(0);
  });

  it('partial cancel: client receives the reduced queue, not the original', () => {
    const { slots, sends } = makeSlots(['p1', 'p2']);
    new Round(slots);
    const [pg1, pg2] = MockPlayerGame.instances;

    pg1.emit('attack', 4);
    vi.clearAllMocks();

    // p2 clears 1 line → engine cancels 1L, 3L remain
    pg2.emit('pendingGarbage', [{ lines: 3, triggerFrame: 500, gap: 2 }]);

    const syncs = garbageSyncs(sends['p2']);
    expect(syncs).toHaveLength(1);
    expect(syncs[0].queue[0].lines).toBe(3);
  });

  it('multiple attacks followed by cancel: client receives each update in order', () => {
    const { slots, sends } = makeSlots(['p1', 'p2']);
    new Round(slots);
    const [pg1, pg2] = MockPlayerGame.instances;

    pg1.emit('attack', 2); // first attack
    pg1.emit('attack', 3); // second attack — MockPlayerGame overwrites queue each time
    pg2.emit('pendingGarbage', []); // cancel

    const syncs = garbageSyncs(sends['p2']);
    expect(syncs).toHaveLength(3); // add, add, cancel
    expect(syncs[2].queue).toHaveLength(0);
  });

  it('attacker does not receive their own garbage_queue_sync', () => {
    const { slots, sends } = makeSlots(['p1', 'p2']);
    new Round(slots);
    const [pg1] = MockPlayerGame.instances;

    pg1.emit('attack', 4);

    expect(garbageSyncs(sends['p1'])).toHaveLength(0);
    expect(garbageSyncs(sends['p2'])).toHaveLength(1);
  });
});

// ── GameEngine.syncGarbageQueue — client-side queue replacement ────────────────

describe('GameEngine.syncGarbageQueue — fires pendingGarbage event for UI sync', () => {
  it('emits the pendingGarbage event so subscribers (e.g. GarbageMeter ref) are updated', () => {
    const engine = new GameEngine({ seed: 1, gravityMode: 'multiplayer' });
    const onPendingGarbage = vi.fn();
    engine.subscribe('pendingGarbage', onPendingGarbage);

    const queue = [{ lines: 4, triggerFrame: 1631, gap: 7 }];
    engine.syncGarbageQueue(queue);

    expect(onPendingGarbage).toHaveBeenCalledOnce();
    expect(onPendingGarbage).toHaveBeenCalledWith(queue);
  });

  it('replaces the queue wholesale — does not accumulate on repeated calls', () => {
    const engine = new GameEngine({ seed: 1, gravityMode: 'multiplayer' });

    engine.syncGarbageQueue([{ lines: 4, triggerFrame: 500, gap: 0 }]);
    engine.syncGarbageQueue([]); // cancel sync arrives

    expect(engine.getState().pendingGarbage).toHaveLength(0);
  });

  it('fires with empty array when the cancel sync arrives', () => {
    const engine = new GameEngine({ seed: 1, gravityMode: 'multiplayer' });
    const onPendingGarbage = vi.fn();
    engine.subscribe('pendingGarbage', onPendingGarbage);

    engine.syncGarbageQueue([{ lines: 4, triggerFrame: 1631, gap: 7 }]);
    engine.syncGarbageQueue([]); // the missing cancel notification from the old protocol

    expect(onPendingGarbage).toHaveBeenCalledTimes(2);
    expect(onPendingGarbage).toHaveBeenLastCalledWith([]);
  });

  it('ghost garbage cannot apply after a cancel sync clears the queue', () => {
    // The original bug: client had {lines:4,triggerFrame:1631} and ticked to frame 1631,
    // causing garbage rows to be injected even though the server had already cancelled it.
    // After a cancel sync, the queue is empty, so tick to triggerFrame does nothing.
    const engine = new GameEngine({ seed: 1, gravityMode: 'multiplayer' });

    const triggerFrame = 50;
    engine.syncGarbageQueue([{ lines: 4, triggerFrame, gap: 0 }]);
    engine.syncGarbageQueue([]); // cancel arrives before triggerFrame

    // Tick past where the ghost garbage would have fired
    for (let i = 0; i < triggerFrame + 5; i++) engine.tick();

    const garbageRows = engine.getState().board.filter(row => row.some(c => c === 8));
    expect(garbageRows).toHaveLength(0);
  });
});
