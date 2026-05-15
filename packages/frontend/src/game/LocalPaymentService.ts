import { PaymentClient } from '@stacktris/shared';

interface BetRecord {
  preimage: Uint8Array;
  paymentHash: string;
  lightningAddress: string;
  status: 'pending' | 'held' | 'settled' | 'cancelled';
  unsub: () => void;
}

/**
 * Manages hold-invoice escrow for a local split-screen session.
 * Mirrors the backend PaymentService but without WS transport concerns.
 */
export class LocalPaymentService {
  private readonly client: PaymentClient;
  private records = new Map<string, BetRecord>();

  constructor(nwcString: string, private readonly buyIn: number) {
    this.client = new PaymentClient(nwcString);
  }

  /**
   * Generates a hold invoice for a player and returns the bolt11 string.
   * `onPaid` is called when the HTLC is accepted (payment is in-flight).
   */
  async generateInvoice(
    playerId: string,
    lightningAddress: string,
    onPaid: () => void,
  ): Promise<string> {
    const { invoice, paymentHash, preimage } = await this.client.generateHoldInvoice(
      this.buyIn,
      'stacktris local buy-in',
    );

    const unsub = await this.client.subscribeHoldInvoiceAccepted(paymentHash, () => {
      const record = this.records.get(playerId);
      if (record) {
        record.status = 'held';
        record.unsub();
        record.unsub = () => {};
      }
      onPaid();
    });

    this.records.set(playerId, {
      preimage,
      paymentHash,
      lightningAddress,
      status: 'pending',
      unsub,
    });

    return invoice;
  }

  /** Update the payout address for a player (can be set after invoice generation). */
  setLightningAddress(playerId: string, address: string): void {
    const record = this.records.get(playerId);
    if (record) record.lightningAddress = address;
  }

  /**
   * Called when the match ends.
   * Settles losers' hold invoices and pays the winner.
   */
  async onMatchComplete(winnerId: string): Promise<void> {
    const winnerRecord = this.records.get(winnerId);
    const loserRecords = [...this.records.entries()].filter(([id]) => id !== winnerId);
    const heldLosers = loserRecords.filter(([, r]) => r.status === 'held');
    const potSats = this.buyIn * heldLosers.length;

    console.log(`[LocalPaymentService] match complete — winner: ${winnerId}, pot: ${potSats} sats`);

    await Promise.allSettled([
      ...heldLosers.map(async ([id, record]) => {
        try {
          await this.client.settleHoldInvoice(record.preimage);
          record.status = 'settled';
          console.log(`[LocalPaymentService] settled loser ${id}`);
        } catch (err) {
          console.error(`[LocalPaymentService] failed to settle loser ${id}:`, err);
        }
      }),
      winnerRecord?.status === 'held'
        ? this.client.cancelHoldInvoice(winnerRecord.paymentHash)
            .then(() => { if (winnerRecord) winnerRecord.status = 'cancelled'; })
            .catch(err => console.error('[LocalPaymentService] failed to cancel winner invoice:', err))
        : Promise.resolve(),
    ]);

    if (potSats > 0 && winnerRecord?.lightningAddress) {
      console.log(`[LocalPaymentService] paying ${potSats} sats to ${winnerRecord.lightningAddress}`);
      try {
        await this.client.payToLightningAddress(winnerRecord.lightningAddress, potSats);
        console.log('[LocalPaymentService] payout success');
      } catch (err) {
        console.error('[LocalPaymentService] payout failed:', err);
      }
    }
  }

  destroy(): void {
    this.records.forEach(r => r.unsub());
    this.records.clear();
    this.client.close();
  }
}
