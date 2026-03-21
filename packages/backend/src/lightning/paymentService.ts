import { PaymentClient } from './paymentClient.js';

export class PaymentService {
  constructor(
    private readonly client: PaymentClient,
    private readonly betSats: number,
  ) {}

  async onMatchComplete(winnerId: string): Promise<void> {
    // TODO: generate payout invoice to winner and collect from losers
    console.log(`[PaymentService] match complete — winner: ${winnerId}, pot: ${this.betSats} sats`);
  }
}
