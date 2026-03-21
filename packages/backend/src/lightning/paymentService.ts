import { SendFn } from '../types.js';
import { PaymentClient } from './paymentClient.js';


type BetRecord = {
  preimage: Uint8Array;
  paymentHash: string;
  lightningAddress: string;
  status: 'pending' | 'held' | 'cancelled' | 'settled';
  createdAt: number;
  expiresAt: number;
  settleDeadline: number | null; // absolute Bitcoin block height — must settle before this block
  unsub: () => void;
}

export class PaymentService {
  private betRecords: Map<string, BetRecord> = new Map(); // playerId -> bet record

  constructor(
    private readonly client: PaymentClient,
    private readonly buyIn: number,
  ) { }

  destroy(): void {
    this.betRecords.forEach(record => record.unsub());
    this.betRecords.clear();
  }

  async onMatchComplete(winnerId: string): Promise<void> {
    const winnerRecord = this.betRecords.get(winnerId);
    const loserRecords = Array.from(this.betRecords.entries()).filter(([id]) => id !== winnerId);
    const heldLoserCount = loserRecords.filter(([, r]) => r.status === 'held').length;
    const potSats = this.buyIn * heldLoserCount;

    console.log(`[PaymentService] match complete — winner: ${winnerId}, pot: ${potSats} sats (${heldLoserCount} losers)`);

    // Settle losers' hold invoices to collect their funds, cancel the winner's.
    await Promise.allSettled([
      ...loserRecords.map(([, record]) => {
        if (record.status !== 'held') return Promise.resolve();
        return this.client.settleHoldInvoice(record.preimage);
      }),
      winnerRecord?.status === 'held'
        ? this.cancelHoldInvoice(winnerId)
        : Promise.resolve(),
    ]);

    // Pay the pot to the winner's lightning address.
    if (potSats > 0 && winnerRecord?.lightningAddress) {
      await this.client.payToLightningAddress(winnerRecord.lightningAddress, potSats);
      console.log(`[PaymentService] paid ${potSats} sats to ${winnerRecord.lightningAddress}`);
    }
  }

  async generateBetInvoice(playerId: string, lightningAddress: string, sendFn: SendFn, onPaid: () => void) {
    const { invoice, paymentHash, preimage, expiresAt } = await this.client.generateHoldInvoice(this.buyIn, `stacktris bet hold invoice`);

    const unsub = await this.client.subscribeHoldInvoiceAccepted(paymentHash, (settleDeadline) => {
      console.log(`[PaymentService] hold invoice accepted for player ${playerId} (settle by block ${settleDeadline})`);
      const record = this.betRecords.get(playerId)!;
      record.status = 'held';
      record.settleDeadline = settleDeadline;
      record.unsub();
      record.unsub = () => { }; // prevent double-call if destroy() runs after hold fires
      sendFn({ type: 'bet_payment_confirmed', playerId });
      onPaid();
    });

    this.betRecords.set(playerId, { preimage, paymentHash, lightningAddress, status: 'pending', createdAt: Date.now(), expiresAt, settleDeadline: null, unsub });

    sendFn({ type: 'bet_invoice_issued', bolt11: invoice, expiresAt });
  }

  async cancelHoldInvoice(playerId: string): Promise<void> {
    const record = this.betRecords.get(playerId);
    if (!record || record.status === 'cancelled') return;

    // Only call the NWC if the HTLC is actually in-flight. A pending (unpaid)
    // invoice has no hold to cancel — it will expire naturally via its expiry field.
    if (record.status === 'held') {
      try {
        await this.client.cancelHoldInvoice(record.paymentHash);
      } catch (err) {
        console.error(`[PaymentService] cancelHoldInvoice failed for ${playerId}:`, err);
      }
    }

    record.status = 'cancelled';

    record.unsub();
  }

  async settleHoldInvoice(playerId: string): Promise<void> {
    const record = this.betRecords.get(playerId);
    if (!record || record.status !== 'held') return;

    try {
      await this.client.settleHoldInvoice(record.preimage);
    } catch (err) {
      console.error(`[PaymentService] settleHoldInvoice failed for ${playerId}:`, err);
    }

    record.status = 'settled';

    record.unsub();
  }
}
