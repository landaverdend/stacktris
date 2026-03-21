import { WebSocket } from 'ws';
import { NWCClient as NWCClientSDK } from '@getalby/sdk';

// @ts-ignore
globalThis.WebSocket ??= WebSocket;

if (!process.env.NWC_STRING) {
  throw new Error('NWC_STRING is not set');
}

export class PaymentClient {
  private client: NWCClientSDK;

  constructor() {
    this.client = new NWCClientSDK({ nostrWalletConnectUrl: process.env.NWC_STRING! });
  }

  async init(): Promise<void> {
    const info = await this.client.getInfo();
    console.log('[nwc] connected:', info);
  }

  async generateHoldInvoice(amountSats: number, description: string): Promise<string> {
    const preimage = crypto.getRandomValues(new Uint8Array(32));

    const hashBuffer = await crypto.subtle.digest('SHA-256', preimage);
    const paymentHash = Buffer.from(hashBuffer).toString('hex');

    const result = await this.client.makeHoldInvoice({ amount: amountSats * 1000, description, payment_hash: paymentHash })

    return result.invoice;
  }
}
