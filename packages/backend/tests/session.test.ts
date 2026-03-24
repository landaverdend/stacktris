import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MAX_PLAYERS, Session } from '../src/game/session.js';
import { PaymentService } from '../src/lightning/paymentService.js';
import { SendFn } from '../src/types.js';
import { WINS_TO_MATCH } from '@stacktris/shared';

// ---- GameSession mock ----
// Captures the 'gameOver' subscriber so tests can fire it on demand.
let _gameOverCallback: ((winnerId: string | null) => void) | null = null;

vi.mock('../src/game/gameSession.js', () => ({
  GameSession: class {
    subscribe(event: string, cb: (id: string | null) => void) {
      if (event === 'gameOver') _gameOverCallback = cb;
    }
    onMessage() {}
    removePlayer() {}
  },
}));

const fireGameOver = (winnerId: string | null) => {
  _gameOverCallback?.(winnerId);
  _gameOverCallback = null;
};

type MockSendFn = ReturnType<typeof vi.fn> & SendFn;
const makeSend = (): MockSendFn => vi.fn() as unknown as MockSendFn;

const makeMockPaymentService = () => {
  const callbacks = new Map<string, () => void>();
  const service = {
    generateBetInvoice: vi.fn((playerId: string, _lightningAddress: string, _sendFn: SendFn, onPaid: () => void) => {
      callbacks.set(playerId, onPaid);
    }),
    onMatchComplete: vi.fn(),
    cancelHoldInvoice: vi.fn(),
    settleHoldInvoice: vi.fn(),
    destroy: vi.fn(),
  } as unknown as PaymentService;
  return {
    service,
    confirmPayment: (playerId: string) => callbacks.get(playerId)?.(),
  };
};

// Free rooms don't require payment — use buyIn=0 for non-payment tests.
const makeRoom = (buyIn = 0) => {
  const { service } = makeMockPaymentService();
  return new Session('room-1', buyIn, service);
};

describe('Room', () => {
  it('adds a player', () => {
    const room = makeRoom();
    room.addPlayer('player-1', '', '', makeSend());
    expect(room.playerCount).toBe(1);
  });

  it('removes a player', () => {
    const room = makeRoom();
    room.addPlayer('player-1', '', '', makeSend());
    room.removePlayer('player-1');
    expect(room.playerCount).toBe(0);
  });

  it('does not exceed MAX_PLAYERS players', () => {
    const room = makeRoom();
    for (let i = 0; i < MAX_PLAYERS; i++) {
      room.addPlayer(`player-${i}`, '', '', makeSend());
    }
    expect(() => room.addPlayer('player-3', '', '', makeSend())).toThrow();
  });

  it('reports isFull correctly', () => {
    const room = makeRoom();
    expect(room.isFull).toBe(false);
    for (let i = 1; i < MAX_PLAYERS; i++) {
      room.addPlayer(`player-${i}`, '', '', makeSend());
      expect(room.isFull).toBe(false);
    }
    room.addPlayer(`player-${MAX_PLAYERS}`, '', '', makeSend());
    expect(room.isFull).toBe(true);
  });

  it('reports isEmpty correctly', () => {
    const room = makeRoom();
    expect(room.isEmpty).toBe(true);
    room.addPlayer('player-1', '', '', makeSend());
    expect(room.isEmpty).toBe(false);
  });

  describe('addPlayer', () => {
    it('throws if the room is in countdown', () => {
      vi.useFakeTimers();
      const room = makeRoom();
      room.addPlayer('player-1', '', '', makeSend());
      room.addPlayer('player-2', '', '', makeSend());

      room.onMessage('player-1', { type: 'ready_update', ready: true });
      room.onMessage('player-2', { type: 'ready_update', ready: true });

      expect(room.status).toBe('countdown');
      expect(() => room.addPlayer('player-3', '', '', makeSend())).toThrow();
      vi.useRealTimers();
    });

    it('throws if the room is in playing', () => {
      vi.useFakeTimers();
      const room = makeRoom();
      room.addPlayer('player-1', '', '', makeSend());
      room.addPlayer('player-2', '', '', makeSend());

      room.onMessage('player-1', { type: 'ready_update', ready: true });
      room.onMessage('player-2', { type: 'ready_update', ready: true });
      vi.advanceTimersByTime(3500);
      expect(room.status).toBe('playing');
      expect(() => room.addPlayer('player-3', '', '', makeSend())).toThrow();
      vi.useRealTimers();
    });
  });

  describe('ready state', () => {
    it('advances to countdown state when all players are ready', () => {
      const room = makeRoom();
      room.addPlayer('player-1', '', '', makeSend());
      room.addPlayer('player-2', '', '', makeSend());

      room.onMessage('player-1', { type: 'ready_update', ready: true });
      room.onMessage('player-2', { type: 'ready_update', ready: true });

      expect(room.status).toBe('countdown');
    });

    it('does not advance to countdown state when not all players are ready', () => {
      const room = makeRoom();
      room.addPlayer('player-1', '', '', makeSend());
      room.addPlayer('player-2', '', '', makeSend());

      room.onMessage('player-1', { type: 'ready_update', ready: true });
      room.onMessage('player-2', { type: 'ready_update', ready: false });
      expect(room.status).toBe('waiting');
    });
  });

  describe('countdown', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('transitions to playing after countdown expires', () => {
      const room = makeRoom();
      room.addPlayer('player-1', '', '', makeSend());
      room.addPlayer('player-2', '', '', makeSend());

      room.onMessage('player-1', { type: 'ready_update', ready: true });
      room.onMessage('player-2', { type: 'ready_update', ready: true });
      expect(room.status).toBe('countdown');
      vi.advanceTimersByTime(3500);
      expect(room.status).toBe('playing');
    });

    it('cancels countdown when a player disconnects', () => {
      const room = makeRoom();
      room.addPlayer('player-1', '', '', makeSend());
      room.addPlayer('player-2', '', '', makeSend());
      room.onMessage('player-1', { type: 'ready_update', ready: true });
      room.onMessage('player-2', { type: 'ready_update', ready: true });
      expect(room.status).toBe('countdown');
      room.removePlayer('player-1');
      vi.runAllTimers();
      expect(room.status).toBe('waiting');
    });

    it('cancels countdown and returns to waiting when a player unreadies', () => {
      const room = makeRoom();
      room.addPlayer('player-1', '', '', makeSend());
      room.addPlayer('player-2', '', '', makeSend());
      room.onMessage('player-1', { type: 'ready_update', ready: true });
      room.onMessage('player-2', { type: 'ready_update', ready: true });
      expect(room.status).toBe('countdown');
      room.onMessage('player-1', { type: 'ready_update', ready: false });
      expect(room.status).toBe('waiting');
      vi.runAllTimers();
      expect(room.status).toBe('waiting');
    });
  });

  describe('payment', () => {
    it('player cannot ready up before paying in a paid room', () => {
      const { service } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true });

      expect(room.status).toBe('waiting');
    });

    it('player can ready up after payment is confirmed', () => {
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      confirmPayment('p1');
      confirmPayment('p2');

      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true });

      expect(room.status).toBe('countdown');
    });

    it('only the paying player is unblocked — unpaid player still cannot ready up', () => {
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      confirmPayment('p1'); // only p1 pays

      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true }); // ignored

      expect(room.status).toBe('waiting');
    });

    it('ready state is not reflected in broadcast while unpaid', () => {
      const { service } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      const send1 = makeSend();
      room.addPlayer('p1', '', '', send1);
      room.addPlayer('p2', '', '', makeSend());

      room.onMessage('p1', { type: 'ready_update', ready: true }); // ignored

      const lastMsg = send1.mock.calls.at(-1)?.[0];
      const p1Info = lastMsg?.roomState?.players?.find((p: { playerId: string }) => p.playerId === 'p1');
      // The ready_update was silently dropped — no new broadcast, so p1 is still not ready
      expect(p1Info?.ready).toBe(false);
    });

    it('countdown does not start when all players ready but none have paid', () => {
      const { service } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true });

      expect(room.status).toBe('waiting');
    });

    it('countdown does not start when only one player has paid and readied', () => {
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      confirmPayment('p1');
      room.onMessage('p1', { type: 'ready_update', ready: true });

      expect(room.status).toBe('waiting');
    });

    it('countdown starts once the last player pays and then readies', () => {
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      // p1 pays and readies first; p2 readies before paying (ignored), then pays
      confirmPayment('p1');
      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true }); // ignored — not paid yet
      expect(room.status).toBe('waiting');

      confirmPayment('p2');
      room.onMessage('p2', { type: 'ready_update', ready: true });
      expect(room.status).toBe('countdown');
    });

    it('ready_update after payment is correctly reflected in the broadcast', () => {
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      const send1 = makeSend();
      room.addPlayer('p1', '', '', send1);
      room.addPlayer('p2', '', '', makeSend());

      confirmPayment('p1');
      room.onMessage('p1', { type: 'ready_update', ready: true });

      const lastMsg = send1.mock.calls.at(-1)?.[0];
      const p1Info = lastMsg?.roomState?.players?.find((p: { playerId: string }) => p.playerId === 'p1');
      expect(p1Info?.ready).toBe(true);
    });

    it('generateBetInvoice is called for each player joining a paid room', () => {
      const { service } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      expect(service.generateBetInvoice).toHaveBeenCalledTimes(2);
      expect(service.generateBetInvoice).toHaveBeenCalledWith('p1', '', expect.any(Function), expect.any(Function));
      expect(service.generateBetInvoice).toHaveBeenCalledWith('p2', '', expect.any(Function), expect.any(Function));
    });

    it('generateBetInvoice is not called for free rooms', () => {
      const { service } = makeMockPaymentService();
      const room = new Session('room-1', 0, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      expect(service.generateBetInvoice).not.toHaveBeenCalled();
    });

    it('payment confirmation triggers a room state broadcast', () => {
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      const send1 = makeSend();
      room.addPlayer('p1', '', '', send1);
      room.addPlayer('p2', '', '', makeSend());

      const callsBefore = send1.mock.calls.length;
      confirmPayment('p1');
      const callsAfter = send1.mock.calls.length;

      expect(callsAfter).toBeGreaterThan(callsBefore);
    });

    it('free room players are automatically considered paid', () => {
      const { service } = makeMockPaymentService();
      const room = new Session('room-1', 0, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true });

      expect(room.status).toBe('countdown');
    });

    it('room_state_update reflects paid=false for unpaid players', () => {
      const { service } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      const send1 = makeSend();
      room.addPlayer('p1', '', '', send1);
      room.addPlayer('p2', '', '', makeSend());

      // The last broadcast sent to p1 after p2 joined
      const lastMsg = send1.mock.calls.at(-1)?.[0];
      const p1Info = lastMsg?.roomState?.players?.find((p: { playerId: string }) => p.playerId === 'p1');
      expect(p1Info?.paid).toBe(false);
    });

    it('room_state_update reflects paid=true after payment confirmed', () => {
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      const send1 = makeSend();
      room.addPlayer('p1', '', '', send1);
      room.addPlayer('p2', '', '', makeSend());

      confirmPayment('p1');

      const lastMsg = send1.mock.calls.at(-1)?.[0];
      const p1Info = lastMsg?.roomState?.players?.find((p: { playerId: string }) => p.playerId === 'p1');
      expect(p1Info?.paid).toBe(true);
    });

    it('the correct sendFn is passed to generateBetInvoice for each player', () => {
      const { service } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      const send1 = makeSend();
      const send2 = makeSend();
      room.addPlayer('p1', '', '', send1);
      room.addPlayer('p2', '', '', send2);

      expect(service.generateBetInvoice).toHaveBeenCalledWith('p1', '', send1, expect.any(Function));
      expect(service.generateBetInvoice).toHaveBeenCalledWith('p2', '', send2, expect.any(Function));
    });

    it('onMatchComplete is called with the winner after enough round wins', () => {
      vi.useFakeTimers();
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      confirmPayment('p1');
      confirmPayment('p2');

      // Round 1 — manually ready up to start the session.
      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true });
      vi.advanceTimersByTime(3500); // countdown → playing

      for (let i = 0; i < WINS_TO_MATCH; i++) {
        fireGameOver('p1');
        if (i < WINS_TO_MATCH - 1) {
          // Subsequent rounds auto-start: inter-round pause → countdown → playing.
          vi.advanceTimersByTime(3000 + 3500);
        }
      }

      expect(service.onMatchComplete).toHaveBeenCalledWith('p1');
      vi.useRealTimers();
    });

    it('onMatchComplete is not called until WINS_TO_MATCH rounds are won', () => {
      vi.useFakeTimers();
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      confirmPayment('p1');
      confirmPayment('p2');

      // Round 1.
      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true });
      vi.advanceTimersByTime(3500);

      for (let i = 0; i < WINS_TO_MATCH - 1; i++) {
        fireGameOver('p1');
        // Subsequent rounds auto-start.
        vi.advanceTimersByTime(3000 + 3500);
      }

      expect(service.onMatchComplete).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('payment confirmation for an unknown player id does not crash', () => {
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());

      // 'ghost' never joined — the callback just won't be in the map
      expect(() => confirmPayment('ghost')).not.toThrow();
      expect(room.status).toBe('waiting');
    });
  });

  describe('disconnect payment behavior', () => {
    it('cancels hold when a player leaves before the session starts', () => {
      const { service } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      room.removePlayer('p1');

      // cancel is called to refund; settle is also called but is a no-op in the
      // real PaymentService because the record won't be in 'held' state
      expect(service.cancelHoldInvoice).toHaveBeenCalledWith('p1');
    });

    it('does not cancel hold when a player leaves after the session starts', () => {
      vi.useFakeTimers();
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      confirmPayment('p1');
      confirmPayment('p2');
      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true });
      vi.advanceTimersByTime(3500); // countdown → playing (_isSessionStarted = true)

      room.removePlayer('p1');

      expect(service.cancelHoldInvoice).not.toHaveBeenCalled();
      expect(service.settleHoldInvoice).toHaveBeenCalledWith('p1');
      vi.useRealTimers();
    });

    it('does not call cancel or settle for free rooms on disconnect', () => {
      const { service } = makeMockPaymentService();
      const room = new Session('room-1', 0, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      room.removePlayer('p1');

      expect(service.cancelHoldInvoice).not.toHaveBeenCalled();
      expect(service.settleHoldInvoice).not.toHaveBeenCalled();
    });

    it('cancels hold during countdown (session not yet started)', () => {
      vi.useFakeTimers();
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      confirmPayment('p1');
      confirmPayment('p2');
      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true });
      expect(room.status).toBe('countdown'); // _isSessionStarted still false

      room.removePlayer('p1');

      expect(service.cancelHoldInvoice).toHaveBeenCalledWith('p1');
      expect(service.cancelHoldInvoice).not.toHaveBeenCalledWith('p2'); // other player unaffected
      vi.useRealTimers();
    });

    it('settles hold when a player leaves between rounds (session already started)', () => {
      vi.useFakeTimers();
      const { service, confirmPayment } = makeMockPaymentService();
      const room = new Session('room-1', 1000, service);
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());

      confirmPayment('p1');
      confirmPayment('p2');
      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true });

      vi.advanceTimersByTime(3500); // game starts → _isSessionStarted = true
      fireGameOver('p2');
      vi.advanceTimersByTime(1000); // mid inter-round pause

      room.removePlayer('p1');

      expect(service.settleHoldInvoice).toHaveBeenCalledWith('p1');
      expect(service.cancelHoldInvoice).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('mid-session auto-restart', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    const startSession = (room: Session) => {
      room.onMessage('p1', { type: 'ready_update', ready: true });
      room.onMessage('p2', { type: 'ready_update', ready: true });
      vi.advanceTimersByTime(3500); // countdown → playing
    };

    it('transitions to countdown (not waiting) after a round ends mid-session', () => {
      const room = makeRoom();
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());
      startSession(room);

      fireGameOver('p1');
      vi.advanceTimersByTime(3000); // inter-round pause

      expect(room.status).toBe('countdown');
    });

    it('next round starts automatically after the inter-round countdown', () => {
      const room = makeRoom();
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());
      startSession(room);

      fireGameOver('p1');
      vi.advanceTimersByTime(3000 + 3500); // pause + countdown

      expect(room.status).toBe('playing');
    });

    it('ready_update is ignored mid-session', () => {
      const room = makeRoom();
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());
      startSession(room);

      fireGameOver('p1');
      vi.advanceTimersByTime(3000); // now in countdown
      expect(room.status).toBe('countdown');

      // ready_update should not cancel the auto-countdown
      room.onMessage('p1', { type: 'ready_update', ready: false });
      expect(room.status).toBe('countdown');

      vi.advanceTimersByTime(3500);
      expect(room.status).toBe('playing');
    });

    it('does not auto-restart when the match is over', () => {
      const room = makeRoom();
      room.addPlayer('p1', '', '', makeSend());
      room.addPlayer('p2', '', '', makeSend());
      startSession(room);

      for (let i = 0; i < WINS_TO_MATCH; i++) {
        if (i > 0) vi.advanceTimersByTime(3000 + 3500);
        fireGameOver('p1');
      }

      vi.advanceTimersByTime(10000);
      expect(room.status).toBe('finished');
    });
  });
});
