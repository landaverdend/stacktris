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

  async generateInvoice(amountSats: number, description: string): Promise<string> {
    const result = await this.client.makeInvoice({ amount: amountSats * 1000, description });
    console.log('[invoice]', result);
    return result.invoice;
  }
}
