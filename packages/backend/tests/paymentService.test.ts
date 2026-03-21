import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '../src/lightning/paymentService.js';
import { PaymentClient } from '../src/lightning/paymentClient.js';
import { SendFn } from '../src/types.js';

// ---- Helpers ----------------------------------------------------------------

type MockSendFn = ReturnType<typeof vi.fn> & SendFn;
const makeSend = (): MockSendFn => vi.fn() as unknown as MockSendFn;

const BOLT11 = 'lnbc1test';
const PAYMENT_HASH = 'abc123';
const PREIMAGE = new Uint8Array(32).fill(1);
const EXPIRES_AT = Date.now() + 3_600_000;

const makeMockClient = () => {
  // Captures the hold-accepted callback so tests can fire it.
  let holdAcceptedCallback: ((deadline: number | null) => void) | null = null;

  const client = {
    generateHoldInvoice: vi.fn().mockResolvedValue({
      invoice: BOLT11,
      paymentHash: PAYMENT_HASH,
      preimage: PREIMAGE,
      expiresAt: EXPIRES_AT,
    }),
    subscribeHoldInvoiceAccepted: vi.fn().mockImplementation(
      (_hash: string, cb: (deadline: number | null) => void) => {
        holdAcceptedCallback = cb;
        return Promise.resolve(() => { holdAcceptedCallback = null; });
      }
    ),
    settleHoldInvoice: vi.fn().mockResolvedValue(undefined),
    cancelHoldInvoice: vi.fn().mockResolvedValue(undefined),
    payToLightningAddress: vi.fn().mockResolvedValue(undefined),
  } as unknown as PaymentClient;

  return {
    client,
    fireHoldAccepted: (deadline: number | null = 999999) => holdAcceptedCallback?.(deadline),
  };
};

// ---- Tests ------------------------------------------------------------------

describe('PaymentService', () => {
  describe('generateBetInvoice', () => {
    it('generates a hold invoice and sends it to the player', async () => {
      const { client } = makeMockClient();
      const service = new PaymentService(client, 1000);
      const send = makeSend();

      await service.generateBetInvoice('p1', 'p1@wallet.com', send, vi.fn());

      expect(client.generateHoldInvoice).toHaveBeenCalledWith(1000, expect.any(String));
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'bet_invoice_issued', bolt11: BOLT11, expiresAt: EXPIRES_AT })
      );
    });

    it('subscribes to hold_invoice_accepted for the generated payment hash', async () => {
      const { client } = makeMockClient();
      const service = new PaymentService(client, 1000);

      await service.generateBetInvoice('p1', 'p1@wallet.com', makeSend(), vi.fn());

      expect(client.subscribeHoldInvoiceAccepted).toHaveBeenCalledWith(PAYMENT_HASH, expect.any(Function));
    });

    it('calls onPaid and sends bet_payment_confirmed when hold is accepted', async () => {
      const { client, fireHoldAccepted } = makeMockClient();
      const service = new PaymentService(client, 1000);
      const send = makeSend();
      const onPaid = vi.fn();

      await service.generateBetInvoice('p1', 'p1@wallet.com', send, onPaid);
      fireHoldAccepted(941621);

      expect(onPaid).toHaveBeenCalledOnce();
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'bet_payment_confirmed', playerId: 'p1' })
      );
    });

    it('records the settle_deadline when hold is accepted, keeping the invoice cancellable', async () => {
      const { client, fireHoldAccepted } = makeMockClient();
      const service = new PaymentService(client, 1000);

      await service.generateBetInvoice('p1', 'p1@wallet.com', makeSend(), vi.fn());
      fireHoldAccepted(941621);

      // Invoice is now held — should still be cancellable (e.g. winner refund path).
      await service.cancelHoldInvoice('p1');
      expect(client.cancelHoldInvoice).toHaveBeenCalledWith(PAYMENT_HASH);
    });
  });

  describe('cancelHoldInvoice', () => {
    it('cancels a pending hold invoice', async () => {
      const { client } = makeMockClient();
      const service = new PaymentService(client, 1000);

      await service.generateBetInvoice('p1', 'p1@wallet.com', makeSend(), vi.fn());
      await service.cancelHoldInvoice('p1');

      expect(client.cancelHoldInvoice).toHaveBeenCalledWith(PAYMENT_HASH);
    });

    it('cancels a held invoice', async () => {
      const { client, fireHoldAccepted } = makeMockClient();
      const service = new PaymentService(client, 1000);

      await service.generateBetInvoice('p1', 'p1@wallet.com', makeSend(), vi.fn());
      fireHoldAccepted();
      await service.cancelHoldInvoice('p1');

      expect(client.cancelHoldInvoice).toHaveBeenCalledWith(PAYMENT_HASH);
    });

    it('is a no-op for an unknown player', async () => {
      const { client } = makeMockClient();
      const service = new PaymentService(client, 1000);

      await expect(service.cancelHoldInvoice('ghost')).resolves.not.toThrow();
      expect(client.cancelHoldInvoice).not.toHaveBeenCalled();
    });

    it('is a no-op if already cancelled', async () => {
      const { client } = makeMockClient();
      const service = new PaymentService(client, 1000);

      await service.generateBetInvoice('p1', 'p1@wallet.com', makeSend(), vi.fn());
      await service.cancelHoldInvoice('p1');
      await service.cancelHoldInvoice('p1'); // second call

      expect(client.cancelHoldInvoice).toHaveBeenCalledOnce();
    });
  });

  describe('onMatchComplete', () => {
    it('settles held loser invoices, cancels the winner hold, and pays out the pot', async () => {
      const winnerPreimage = new Uint8Array(32).fill(2);
      const loserPreimage = new Uint8Array(32).fill(3);
      const winnerHash = 'winner-hash';
      const loserHash = 'loser-hash';

      const holdCallbacks: Array<(d: number | null) => void> = [];
      const client = {
        generateHoldInvoice: vi.fn()
          .mockResolvedValueOnce({ invoice: BOLT11, paymentHash: winnerHash, preimage: winnerPreimage, expiresAt: EXPIRES_AT })
          .mockResolvedValueOnce({ invoice: BOLT11, paymentHash: loserHash, preimage: loserPreimage, expiresAt: EXPIRES_AT }),
        subscribeHoldInvoiceAccepted: vi.fn().mockImplementation(
          (_hash: string, cb: (d: number | null) => void) => {
            holdCallbacks.push(cb);
            return Promise.resolve(() => {});
          }
        ),
        settleHoldInvoice: vi.fn().mockResolvedValue(undefined),
        cancelHoldInvoice: vi.fn().mockResolvedValue(undefined),
        payToLightningAddress: vi.fn().mockResolvedValue(undefined),
      } as unknown as PaymentClient;

      const service = new PaymentService(client, 1000);
      await service.generateBetInvoice('winner', 'winner@wallet.com', makeSend(), vi.fn());
      await service.generateBetInvoice('loser', 'loser@wallet.com', makeSend(), vi.fn());

      // Both players pay — fire each hold callback
      holdCallbacks[0]?.(941621); // winner
      holdCallbacks[1]?.(941621); // loser

      await service.onMatchComplete('winner');

      expect(client.settleHoldInvoice).toHaveBeenCalledWith(loserPreimage);
      expect(client.cancelHoldInvoice).toHaveBeenCalledWith(winnerHash);
      expect(client.payToLightningAddress).toHaveBeenCalledWith('winner@wallet.com', 1000);
    });

    it('skips settling non-held (pending) losers', async () => {
      const { client } = makeMockClient();
      const service = new PaymentService(client, 1000);

      // loser never pays (status stays 'pending')
      await service.generateBetInvoice('winner', 'winner@wallet.com', makeSend(), vi.fn());
      await service.generateBetInvoice('loser', 'loser@wallet.com', makeSend(), vi.fn());

      await service.onMatchComplete('winner');

      expect(client.settleHoldInvoice).not.toHaveBeenCalled();
    });

    it('pays zero sats when no losers have held invoices', async () => {
      const { client } = makeMockClient();
      const service = new PaymentService(client, 1000);

      await service.generateBetInvoice('winner', 'winner@wallet.com', makeSend(), vi.fn());
      await service.generateBetInvoice('loser', 'loser@wallet.com', makeSend(), vi.fn());

      await service.onMatchComplete('winner');

      expect(client.payToLightningAddress).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('unsubscribes all active subscriptions', async () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      let call = 0;
      const { client } = makeMockClient();
      (client.subscribeHoldInvoiceAccepted as ReturnType<typeof vi.fn>).mockImplementation(() => {
        return Promise.resolve(call++ === 0 ? unsub1 : unsub2);
      });

      const service = new PaymentService(client, 1000);
      await service.generateBetInvoice('p1', 'p1@wallet.com', makeSend(), vi.fn());
      await service.generateBetInvoice('p2', 'p2@wallet.com', makeSend(), vi.fn());

      service.destroy();

      expect(unsub1).toHaveBeenCalledOnce();
      expect(unsub2).toHaveBeenCalledOnce();
    });

    it('does not call unsub for a record whose subscription already fired', async () => {
      const unsub = vi.fn();
      const { client } = makeMockClient();
      (client.subscribeHoldInvoiceAccepted as ReturnType<typeof vi.fn>).mockResolvedValue(unsub);

      const service = new PaymentService(client, 1000);
      await service.generateBetInvoice('p1', 'p1@wallet.com', makeSend(), vi.fn());

      // Fire accepted — the service calls unsub internally when the hold fires
      const cb = (client.subscribeHoldInvoiceAccepted as ReturnType<typeof vi.fn>).mock.calls[0][1];
      cb(941621);
      unsub.mockClear();

      service.destroy();

      expect(unsub).not.toHaveBeenCalled();
    });
  });
});
