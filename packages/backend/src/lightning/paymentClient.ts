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

  async lookupInvoice(paymentHash: string) {
    const result = await this.client.lookupInvoice({ payment_hash: paymentHash });

    return result;
  }

  async generateHoldInvoice(amountSats: number, description: string) {
    const preimage = crypto.getRandomValues(new Uint8Array(32));

    const hashBuffer = await crypto.subtle.digest('SHA-256', preimage);
    const paymentHash = Buffer.from(hashBuffer).toString('hex');

    const result = await this.client.makeHoldInvoice({ amount: amountSats * 1000, description, payment_hash: paymentHash, expiry: 3600 });

    console.log('[invoice] ', result);

    // expires_at is a Unix timestamp in seconds — convert to ms for consistency.
    return { invoice: result.invoice, paymentHash, preimage, expiresAt: result.expires_at * 1000 };
  }

  async settleHoldInvoice(preimage: Uint8Array): Promise<void> {
    const preimageHex = Buffer.from(preimage).toString('hex');
    await this.client.settleHoldInvoice({ preimage: preimageHex });
  }

  async payToLightningAddress(lightningAddress: string, amountSats: number): Promise<void> {
    const { LightningAddress } = await import('@getalby/lightning-tools');
    const ln = new LightningAddress(lightningAddress);
    await ln.fetch();
    const invoice = await ln.requestInvoice({ satoshi: amountSats });
    await this.client.payInvoice({ invoice: invoice.paymentRequest });
  }

  async cancelHoldInvoice(paymentHash: string): Promise<void> {
    await this.client.cancelHoldInvoice({ payment_hash: paymentHash });
  }

  async subscribeHoldInvoiceAccepted(paymentHash: string, onAccepted: (settleDeadline: number | null) => void): Promise<() => void> {
    return this.client.subscribeNotifications((notification) => {
      if (
        notification.notification_type === 'hold_invoice_accepted' &&
        notification.notification.payment_hash === paymentHash
      ) {
        console.log('[PaymentClient] hold invoice accepted:', notification.notification);
        onAccepted(notification.notification.settle_deadline ?? null);
      }
    }, ['hold_invoice_accepted']);
  }

}
