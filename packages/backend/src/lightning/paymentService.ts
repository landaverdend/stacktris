import { SendFn } from '../types.js';
import { PaymentClient } from './paymentClient.js';


type BetRecord = {
  preimage: Uint8Array;
  paymentHash: string;
  status: 'pending' | 'held' | 'cancelled';
  createdAt: number;
  expiresAt: number;
  settleDeadline: number | null;
  unsub: () => void;
}

export class PaymentService {
  private betRecords: Map<string, BetRecord> = new Map(); // playerId -> bet record

  constructor(
    private readonly client: PaymentClient,
    private readonly betSats: number,
  ) { }

  destroy(): void {
    this.betRecords.forEach(record => record.unsub());
    this.betRecords.clear();
  }

  async onMatchComplete(winnerId: string): Promise<void> {
    console.log(`[PaymentService] match complete — winner: ${winnerId}, pot: ${this.betSats} sats`);

    await Promise.allSettled(
      Array.from(this.betRecords.entries()).map(([playerId, record]) => {
        if (record.status !== 'held') return Promise.resolve();
        if (playerId === winnerId) {
          return this.client.settleHoldInvoice(record.preimage);
        } else {
          return this.cancelHoldInvoice(playerId);
        }
      })
    );
  }

  async generateBetInvoice(playerId: string, sendFn: SendFn, onPaid: () => void) {
    const { invoice, paymentHash, preimage, expiresAt } = await this.client.generateHoldInvoice(this.betSats, `stacktris bet hold invoice`);

    const unsub = await this.client.subscribeHoldInvoiceAccepted(paymentHash, (settleDeadline) => {
      console.log(`[PaymentService] hold invoice accepted for player ${playerId}`);
      const record = this.betRecords.get(playerId)!;
      record.status = 'held';
      record.settleDeadline = settleDeadline;
      record.unsub();
      sendFn({ type: 'bet_payment_confirmed', playerId });
      onPaid();
    });

    this.betRecords.set(playerId, { preimage, paymentHash, status: 'pending', createdAt: Date.now(), expiresAt, settleDeadline: null, unsub });

    sendFn({ type: 'bet_invoice_issued', bolt11: invoice, expiresAt });
  }

  async cancelHoldInvoice(playerId: string): Promise<void> {
    const record = this.betRecords.get(playerId);
    if (!record || record.status === 'cancelled') return;
    await this.client.cancelHoldInvoice(record.paymentHash);
    record.status = 'cancelled';
    record.unsub();
  }
}
