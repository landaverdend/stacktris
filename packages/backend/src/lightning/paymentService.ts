import { SendFn } from '../types.js';
import { PaymentClient } from './paymentClient.js';

export class PaymentService {


  private holdInvoices: Map<string, { preimage: string; paymentHash: string }> = new Map();

  constructor(
    private readonly client: PaymentClient,
    private readonly betSats: number,
  ) { }

  async onMatchComplete(winnerId: string): Promise<void> {
    // TODO: generate payout invoice to winner and collect from losers
    console.log(`[PaymentService] match complete — winner: ${winnerId}, pot: ${this.betSats} sats`);
  }


  async generateBetInvoice(playerId: string, sendFn: SendFn, onPaid: () => void) {
    const invoice = await this.client.generateHoldInvoice(this.betSats, `stacktris bet hold invoice`);

    sendFn({ type: 'bet_invoice_issued', bolt11: invoice, expiresAt: Date.now() + 600000 });
  }

}
