import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ServerMsg } from '@stacktris/shared';

type SendMock = Mock<(msg: ServerMsg) => void>;

// ── Mock PlayerGame ───────────────────────────────────────────────────────────
// Keep a registry so each test can grab the instances GameSession created and
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

vi.mock('../src/playerGame.js', () => ({ PlayerGame: MockPlayerGame }));

// Import AFTER mock registration
const { GameSession } = await import('../src/gameSession.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeSend = (): SendMock => vi.fn();

function makeSlots(ids: string[]): { slots: { playerId: string; sendFn: SendMock; ready: boolean }[]; sends: Record<string, SendMock> } {
  const sends: Record<string, SendMock> = {};
  const slots = ids.map(id => {
    sends[id] = makeSend();
    return { playerId: id, sendFn: sends[id], ready: true };
  });
  return { slots, sends };
}

/** Grab the ServerMsg types from all calls made to a send fn. */
function sentTypes(send: SendMock): string[] {
  return send.mock.calls.map(([msg]) => msg.type);
}

function sentMessages(send: SendMock): ServerMsg[] {
  return send.mock.calls.map(([msg]) => msg);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameSession — game over', () => {
  beforeEach(() => {
    MockPlayerGame.instances = [];
    vi.clearAllMocks();
  });

  it('declares the last survivor the winner in a 3-player game', () => {
    const { slots, sends } = makeSlots(['p1', 'p2', 'p3']);
    const session = new GameSession(slots);

    const [pg1, pg2] = MockPlayerGame.instances;
    const onGameOver = vi.fn();
    session.subscribe('gameOver', onGameOver);

    // p1 dies first — 2 alive, no winner yet
    pg1.emit('gameOver');
    expect(onGameOver).not.toHaveBeenCalled();

    // p2 dies — 1 alive: p3 wins
    pg2.emit('gameOver');
    expect(onGameOver).toHaveBeenCalledOnce();
    expect(onGameOver).toHaveBeenCalledWith('p3');

    // Confirm game_over broadcast reached every player
    for (const send of Object.values(sends)) {
      const gameOverMsg = sentMessages(send).find(m => m.type === 'game_over');
      expect(gameOverMsg).toMatchObject({ type: 'game_over', winnerId: 'p3' });
    }
  });

  it('declares a draw (winnerId: null) when only one player is in the session and they die', () => {
    // The size === 0 branch is hit when the very last alive player dies —
    // practically this means a solo session (no opponent to be the winner).
    const { slots, sends } = makeSlots(['p1']);
    const session = new GameSession(slots);

    const [pg1] = MockPlayerGame.instances;
    const onGameOver = vi.fn();
    session.subscribe('gameOver', onGameOver);

    pg1.emit('gameOver');

    expect(onGameOver).toHaveBeenCalledOnce();
    expect(onGameOver).toHaveBeenCalledWith(null);

    const gameOverMsg = sentMessages(sends['p1']).find(m => m.type === 'game_over');
    expect(gameOverMsg).toMatchObject({ type: 'game_over', winnerId: null });
  });

  it('does not emit gameOver more than once even if multiple players die after the winner is decided', () => {
    const { slots } = makeSlots(['p1', 'p2', 'p3']);
    const session = new GameSession(slots);

    const [pg1, pg2, pg3] = MockPlayerGame.instances as MockPlayerGame[];
    const onGameOver = vi.fn();
    session.subscribe('gameOver', onGameOver);

    pg1.emit('gameOver');
    pg2.emit('gameOver'); // winner decided: p3
    pg3.emit('gameOver'); // stale event — should be ignored

    expect(onGameOver).toHaveBeenCalledOnce();
  });

  it('broadcasts game_over to all players, including the loser', () => {
    const { slots, sends } = makeSlots(['p1', 'p2']);
    new GameSession(slots);

    const [pg1] = MockPlayerGame.instances;
    pg1.emit('gameOver');

    // Both p1 (loser) and p2 (winner) should receive the message
    expect(sentTypes(sends['p1'])).toContain('game_over');
    expect(sentTypes(sends['p2'])).toContain('game_over');
  });

  it('works correctly with 4 players, eliminating one at a time', () => {
    const { slots } = makeSlots(['p1', 'p2', 'p3', 'p4']);
    const session = new GameSession(slots);

    const [pg1, pg2, pg3] = MockPlayerGame.instances;
    const onGameOver = vi.fn();
    session.subscribe('gameOver', onGameOver);

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
    new GameSession(slots);

    const [pg1, pg2, pg3] = MockPlayerGame.instances;

    // Eliminate p2
    pg2.emit('gameOver');

    vi.clearAllMocks();

    // p1 sends an attack — should only reach p3, not the eliminated p2
    pg1.emit('attack', 2);

    expect(pg3.addGarbage).toHaveBeenCalled();
    expect(pg2.addGarbage).not.toHaveBeenCalled();
    expect(sentTypes(sends['p3'])).toContain('game_garbage_incoming');
    expect(sentTypes(sends['p2'])).not.toContain('game_garbage_incoming');
  });
});
