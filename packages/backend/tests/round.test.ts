import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ServerMsg } from '@stacktris/shared';

type SendMock = Mock<(msg: ServerMsg) => void>;

// ── Mock PlayerGame ───────────────────────────────────────────────────────────
// Keep a registry so each test can grab the instances Round created and
// fire events on them directly.

type Handler = (val?: any) => void;

class MockPlayerGame {
  static instances: MockPlayerGame[] = [];

  frameCount = 0;
  snapshot = { board: [], activePiece: null, holdPiece: null };

  private handlers = new Map<string, Set<Handler>>();

  constructor(_seed: number) {
    MockPlayerGame.instances.push(this);
  }

  subscribe(event: string, fn: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return () => this.handlers.get(event)?.delete(fn);
  }

  /** Test helper — fires a subscribed event as if the engine emitted it. */
  emit(event: string, val?: any) {
    this.handlers.get(event)?.forEach(fn => fn(val));
  }

  addGarbage = vi.fn();
  handleInput = vi.fn();
}

vi.mock('../src/game/playerGame.js', () => ({ PlayerGame: MockPlayerGame }));

// Import AFTER mock registration
const { Round } = await import('../src/game/round.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeSend = (): SendMock => vi.fn();

function makeSlots(ids: string[]): { slots: { playerId: string; playerName: string; lightningAddress: string; sendFn: SendMock; ready: boolean; paid: boolean }[]; sends: Record<string, SendMock> } {
  const sends: Record<string, SendMock> = {};
  const slots = ids.map(id => {
    sends[id] = makeSend();
    return { playerId: id, playerName: id, lightningAddress: '', sendFn: sends[id], ready: true, paid: true };
  });
  return { slots, sends };
}

/** Grab the ServerMsg types from all calls made to a send fn. */
function sentTypes(send: SendMock): string[] {
  return send.mock.calls.map(([msg]) => msg.type);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Round — game over', () => {
  beforeEach(() => {
    MockPlayerGame.instances = [];
    vi.clearAllMocks();
  });

  it('declares the last survivor the winner in a 3-player game', () => {
    const { slots } = makeSlots(['p1', 'p2', 'p3']);
    const round = new Round(slots);

    const [pg1, pg2] = MockPlayerGame.instances;
    const onGameOver = vi.fn();
    round.subscribe('gameOver', onGameOver);

    pg1.emit('gameOver');
    expect(onGameOver).not.toHaveBeenCalled();

    pg2.emit('gameOver');
    expect(onGameOver).toHaveBeenCalledOnce();
    expect(onGameOver).toHaveBeenCalledWith('p3');
  });

  it('declares a draw (winnerId: null) when the last alive player dies', () => {
    const { slots } = makeSlots(['p1']);
    const round = new Round(slots);

    const [pg1] = MockPlayerGame.instances;
    const onGameOver = vi.fn();
    round.subscribe('gameOver', onGameOver);

    pg1.emit('gameOver');

    expect(onGameOver).toHaveBeenCalledOnce();
    expect(onGameOver).toHaveBeenCalledWith(null);
  });

  it('does not emit gameOver more than once even if multiple players die after the winner is decided', () => {
    const { slots } = makeSlots(['p1', 'p2', 'p3']);
    const round = new Round(slots);

    const [pg1, pg2, pg3] = MockPlayerGame.instances as MockPlayerGame[];
    const onGameOver = vi.fn();
    round.subscribe('gameOver', onGameOver);

    pg1.emit('gameOver');
    pg2.emit('gameOver'); // winner decided: p3
    pg3.emit('gameOver'); // stale event — should be ignored

    expect(onGameOver).toHaveBeenCalledOnce();
  });

  it('works correctly with 4 players, eliminating one at a time', () => {
    const { slots } = makeSlots(['p1', 'p2', 'p3', 'p4']);
    const round = new Round(slots);

    const [pg1, pg2, pg3] = MockPlayerGame.instances;
    const onGameOver = vi.fn();
    round.subscribe('gameOver', onGameOver);

    pg1.emit('gameOver'); // 3 alive
    expect(onGameOver).not.toHaveBeenCalled();

    pg2.emit('gameOver'); // 2 alive
    expect(onGameOver).not.toHaveBeenCalled();

    pg3.emit('gameOver'); // 1 alive — p4 wins
    expect(onGameOver).toHaveBeenCalledOnce();
    expect(onGameOver).toHaveBeenCalledWith('p4');
  });

  it('does not route garbage to eliminated players', () => {
    const { slots, sends } = makeSlots(['p1', 'p2', 'p3']);
    new Round(slots);

    const [pg1, pg2, pg3] = MockPlayerGame.instances;

    pg2.emit('gameOver');
    vi.clearAllMocks();

    pg1.emit('attack', 2);

    expect(pg3.addGarbage).toHaveBeenCalled();
    expect(pg2.addGarbage).not.toHaveBeenCalled();
    expect(sentTypes(sends['p3'])).toContain('game_garbage_incoming');
    expect(sentTypes(sends['p2'])).not.toContain('game_garbage_incoming');
  });
});

// ── PPT-style targeting ───────────────────────────────────────────────────────

describe('Round — garbage targeting', () => {
  beforeEach(() => {
    MockPlayerGame.instances = [];
    vi.clearAllMocks();
  });

  it('sends garbage to exactly one player, not all', () => {
    const { slots, sends } = makeSlots(['p1', 'p2', 'p3']);
    new Round(slots);

    const [pg1] = MockPlayerGame.instances;
    pg1.emit('attack', 2);

    const receivers = ['p2', 'p3'].filter(id => sentTypes(sends[id]).includes('game_garbage_incoming'));
    expect(receivers).toHaveLength(1);
  });

  it('cycles the target on successive attacks', () => {
    const { slots, sends } = makeSlots(['p1', 'p2', 'p3']);
    new Round(slots);

    const [pg1] = MockPlayerGame.instances;

    pg1.emit('attack', 2);
    const first = ['p2', 'p3'].find(id => sentTypes(sends[id]).includes('game_garbage_incoming'))!;

    vi.clearAllMocks();

    pg1.emit('attack', 2);
    const second = ['p2', 'p3'].find(id => sentTypes(sends[id]).includes('game_garbage_incoming'))!;

    expect(second).not.toBe(first);
  });

  it('cycles back around after reaching the end of the player order', () => {
    const { slots, sends } = makeSlots(['p1', 'p2', 'p3']);
    new Round(slots);

    const [pg1] = MockPlayerGame.instances;

    pg1.emit('attack', 1);
    const first = ['p2', 'p3'].find(id => sentTypes(sends[id]).includes('game_garbage_incoming'))!;
    vi.clearAllMocks();

    pg1.emit('attack', 1);
    vi.clearAllMocks();

    pg1.emit('attack', 1);
    const third = ['p2', 'p3'].find(id => sentTypes(sends[id]).includes('game_garbage_incoming'))!;

    expect(third).toBe(first);
  });

  it('in a 2-player game always targets the opponent', () => {
    const { slots, sends } = makeSlots(['p1', 'p2']);
    new Round(slots);

    const [pg1] = MockPlayerGame.instances;

    pg1.emit('attack', 2);
    expect(sentTypes(sends['p2'])).toContain('game_garbage_incoming');
    expect(sentTypes(sends['p1'])).not.toContain('game_garbage_incoming');

    vi.clearAllMocks();

    pg1.emit('attack', 2);
    expect(sentTypes(sends['p2'])).toContain('game_garbage_incoming');
    expect(sentTypes(sends['p1'])).not.toContain('game_garbage_incoming');
  });

  it('sends no garbage when the attacker is the last alive player', () => {
    const { slots, sends } = makeSlots(['p1', 'p2']);
    new Round(slots);

    const [pg1, pg2] = MockPlayerGame.instances;
    pg2.emit('gameOver');
    vi.clearAllMocks();

    pg1.emit('attack', 4);
    expect(sentTypes(sends['p1'])).not.toContain('game_garbage_incoming');
    expect(sentTypes(sends['p2'])).not.toContain('game_garbage_incoming');
  });

  it('killPlayer cleans up the player so they no longer receive garbage', () => {
    const { slots, sends } = makeSlots(['p1', 'p2', 'p3']);
    const round = new Round(slots);

    const [pg1] = MockPlayerGame.instances;

    round.killPlayer('p2');
    vi.clearAllMocks();

    pg1.emit('attack', 2);

    expect(sentTypes(sends['p3'])).toContain('game_garbage_incoming');
    expect(sentTypes(sends['p2'])).not.toContain('game_garbage_incoming');
  });

  it('killPlayer triggers gameOver when only one player remains', () => {
    const { slots } = makeSlots(['p1', 'p2', 'p3']);
    const round = new Round(slots);

    const onGameOver = vi.fn();
    round.subscribe('gameOver', onGameOver);

    round.killPlayer('p1');
    expect(onGameOver).not.toHaveBeenCalled();

    round.killPlayer('p2');
    expect(onGameOver).toHaveBeenCalledOnce();
    expect(onGameOver).toHaveBeenCalledWith('p3');
  });

  it('skips multiple consecutive dead players', () => {
    const { slots, sends } = makeSlots(['p1', 'p2', 'p3', 'p4']);
    new Round(slots);

    const [pg1, pg2, pg3] = MockPlayerGame.instances;

    pg2.emit('gameOver');
    pg3.emit('gameOver');
    vi.clearAllMocks();

    pg1.emit('attack', 2);

    expect(sentTypes(sends['p4'])).toContain('game_garbage_incoming');
    expect(sentTypes(sends['p2'])).not.toContain('game_garbage_incoming');
    expect(sentTypes(sends['p3'])).not.toContain('game_garbage_incoming');
  });

  it('pending garbage does not carry over to a new round', () => {
    const { slots } = makeSlots(['p1', 'p2']);
    new Round(slots);

    const [pg1_r1, pg2_r1] = MockPlayerGame.instances;

    // p1 sends garbage to p2 during round 1
    pg1_r1.emit('attack', 4);
    expect(pg2_r1.addGarbage).toHaveBeenCalledWith(4, expect.any(Number));

    // Round 1 ends
    pg1_r1.emit('gameOver');

    MockPlayerGame.instances = [];
    vi.clearAllMocks();

    // Round 2 starts with fresh instances
    new Round(slots);
    const [pg1_r2, pg2_r2] = MockPlayerGame.instances;

    expect(pg2_r2.addGarbage).not.toHaveBeenCalled();
    expect(pg1_r2.addGarbage).not.toHaveBeenCalled();
  });
});
