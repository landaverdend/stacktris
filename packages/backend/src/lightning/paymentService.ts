import { SendFn } from '../types.js';
import { PaymentClient } from './paymentClient.js';


type BetRecord = {
  preimage: Uint8Array;
  paymentHash: string;
  lightningAddress: string;
  sendFn: SendFn;
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

    console.log(`[PaymentService] match complete — winner: ${winnerId}, pot: ${potSats} sats`);
    console.log(`[PaymentService] bet records at match end:`);
    for (const [id, r] of this.betRecords.entries()) {
      const role = id === winnerId ? 'WINNER' : 'LOSER';
      const deadline = r.settleDeadline !== null ? `settle_deadline=block ${r.settleDeadline}` : 'no deadline';
      console.log(`  [${role}] ${id} status=${r.status} ${deadline}`);
    }

    if (!winnerRecord) {
      console.error(`[PaymentService] no bet record found for winner ${winnerId} — cannot proceed with settlement`);
      return;
    }

    // Settle losers' hold invoices to collect their funds, cancel the winner's.
    console.log(`[PaymentService] settling ${heldLoserCount} loser invoice(s), cancelling winner invoice...`);
    const results = await Promise.allSettled([
      ...loserRecords.map(([id, record]) => {
        if (record.status !== 'held') {
          console.log(`[PaymentService] skipping loser ${id} — status=${record.status}`);
          return Promise.resolve();
        }
        console.log(`[PaymentService] settling hold invoice for loser ${id} (hash=${record.paymentHash})`);
        return this.client.settleHoldInvoice(record.preimage)
          .then(() => console.log(`[PaymentService] settled loser ${id}`))
          .catch(err => { throw Object.assign(err, { _playerId: id }); });
      }),
      winnerRecord.status === 'held'
        ? this.cancelHoldInvoice(winnerId).then(() => console.log(`[PaymentService] cancelled winner invoice ${winnerId}`))
        : Promise.resolve(),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        const id = (result.reason as any)._playerId ?? 'winner';
        console.error(`[PaymentService] invoice operation failed for ${id}:`, result.reason);
      }
    }

    // Pay the pot to the winner's lightning address.
    if (potSats > 0 && winnerRecord.lightningAddress) {
      console.log(`[PaymentService] paying out ${potSats} sats to ${winnerRecord.lightningAddress}...`);
      await this.payWithRetry(winnerId, winnerRecord.lightningAddress, potSats, winnerRecord.sendFn);
    } else {
      console.log(`[PaymentService] no payout — potSats=${potSats} lightningAddress=${winnerRecord.lightningAddress || 'none'}`);
    }
  }

  private async payWithRetry(
    winnerId: string,
    address: string,
    amountSats: number,
    sendFn: SendFn | undefined,
    attempts = 6,
    delayMs = 3000,
  ): Promise<void> {
    for (let i = 1; i <= attempts; i++) {
      try {
        console.log(`[PaymentService] payout attempt ${i}/${attempts} — ${amountSats} sats → ${address}`);
        await this.client.payToLightningAddress(address, amountSats);
        console.log(`[PaymentService] payout success — ${amountSats} sats → ${address}`);
        return;
      } catch (err) {
        console.error(`[PaymentService] payout attempt ${i}/${attempts} failed for ${winnerId}:`, err);
        if (i < attempts) {
          console.log(`[PaymentService] retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }

    // All retries exhausted — log for manual recovery and notify the winner.
    console.error(`[PAYOUT FAILED] winner=${winnerId} address=${address} amount=${amountSats} sats — requires manual payment`);
    sendFn?.({ type: 'payout_pending', amountSats, lightningAddress: address });
  }

  async generateBetInvoice(playerId: string, slotIndex: number, lightningAddress: string, sendFn: SendFn, onPaid: () => void) {
    console.log(`[PaymentService] generating hold invoice for player ${playerId} (${this.buyIn} sats, address=${lightningAddress})`);
    const { invoice, paymentHash, preimage, expiresAt } = await this.client.generateHoldInvoice(this.buyIn, `stacktris bet hold invoice`);
    console.log(`[PaymentService] hold invoice created for ${playerId} — hash=${paymentHash} expiresAt=${new Date(expiresAt).toISOString()}`);

    const unsub = await this.client.subscribeHoldInvoiceAccepted(paymentHash, (settleDeadline) => {
      console.log(`[PaymentService] hold invoice accepted for player ${playerId} — hash=${paymentHash} settle_deadline=block ${settleDeadline}`);
      const record = this.betRecords.get(playerId)!;
      record.status = 'held';
      record.settleDeadline = settleDeadline;
      record.unsub();
      record.unsub = () => { }; // prevent double-call if destroy() runs after hold fires
      sendFn({ type: 'bet_payment_confirmed', slotIndex });
      onPaid();
    });

    this.betRecords.set(playerId, { preimage, paymentHash, lightningAddress, sendFn, status: 'pending', createdAt: Date.now(), expiresAt, settleDeadline: null, unsub });

    console.log(`[PaymentService] waiting for payment from ${playerId}...`);
    sendFn({ type: 'bet_invoice_issued', bolt11: invoice, expiresAt });
  }

  async cancelHoldInvoice(playerId: string): Promise<void> {
    const record = this.betRecords.get(playerId);
    if (!record || record.status === 'cancelled') {
      console.log(`[PaymentService] cancelHoldInvoice skipped for ${playerId} — status=${record?.status ?? 'not found'}`);
      return;
    }

    // Only call the NWC if the HTLC is actually in-flight. A pending (unpaid)
    // invoice has no hold to cancel — it will expire naturally via its expiry field.
    if (record.status === 'held') {
      console.log(`[PaymentService] cancelling hold invoice for ${playerId} (hash=${record.paymentHash})`);
      try {
        await this.client.cancelHoldInvoice(record.paymentHash);
        console.log(`[PaymentService] hold invoice cancelled for ${playerId}`);
      } catch (err) {
        console.error(`[PaymentService] cancelHoldInvoice failed for ${playerId}:`, err);
      }
    } else {
      console.log(`[PaymentService] hold invoice for ${playerId} is unpaid (status=${record.status}) — will expire naturally`);
    }

    record.status = 'cancelled';
    record.unsub();
  }

  async settleHoldInvoice(playerId: string): Promise<void> {
    const record = this.betRecords.get(playerId);
    if (!record || record.status !== 'held') {
      console.log(`[PaymentService] settleHoldInvoice skipped for ${playerId} — status=${record?.status ?? 'not found'}`);
      return;
    }

    console.log(`[PaymentService] settling hold invoice for ${playerId} (hash=${record.paymentHash} deadline=block ${record.settleDeadline})`);
    try {
      await this.client.settleHoldInvoice(record.preimage);
      console.log(`[PaymentService] hold invoice settled for ${playerId}`);
    } catch (err) {
      console.error(`[PaymentService] settleHoldInvoice failed for ${playerId}:`, err);
    }

    record.status = 'settled';
    record.unsub();
  }
}
