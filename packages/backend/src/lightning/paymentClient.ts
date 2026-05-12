import { WebSocket } from 'ws';
import { NWCClient as NWCClientSDK } from '@getalby/sdk';

// @ts-ignore
globalThis.WebSocket ??= WebSocket;

export class PaymentClient {
  private client: NWCClientSDK | null;

  constructor() {
    this.client = process.env.NWC_STRING
      ? new NWCClientSDK({ nostrWalletConnectUrl: process.env.NWC_STRING })
      : null;
  }

  async init(): Promise<void> {
    if (!this.client) {
      console.warn('[nwc] NWC_STRING not set — Lightning payments disabled');
      return;
    }
    const info = await this.client.getInfo();
    console.log('[nwc] connected:', info);
  }

  async lookupInvoice(paymentHash: string) {
    if (!this.client) throw new Error('Lightning not configured');
    const result = await this.client.lookupInvoice({ payment_hash: paymentHash });
    return result;
  }

  async generateHoldInvoice(amountSats: number, description: string) {
    if (!this.client) throw new Error('Lightning not configured');
    const preimage = crypto.getRandomValues(new Uint8Array(32));
    const hashBuffer = await crypto.subtle.digest('SHA-256', preimage);
    const paymentHash = Buffer.from(hashBuffer).toString('hex');
    const result = await this.client.makeHoldInvoice({ amount: amountSats * 1000, description, payment_hash: paymentHash, expiry: 86400 });
    return { invoice: result.invoice, paymentHash, preimage, expiresAt: result.expires_at * 1000 };
  }

  async settleHoldInvoice(preimage: Uint8Array): Promise<void> {
    if (!this.client) throw new Error('Lightning not configured');
    const preimageHex = Buffer.from(preimage).toString('hex');
    await this.client.settleHoldInvoice({ preimage: preimageHex });
  }

  async payToLightningAddress(lightningAddress: string, amountSats: number): Promise<void> {
    if (!this.client) throw new Error('Lightning not configured');
    const { LightningAddress } = await import('@getalby/lightning-tools');
    const ln = new LightningAddress(lightningAddress);
    await ln.fetch();
    const invoice = await ln.requestInvoice({ satoshi: amountSats });
    await this.client.payInvoice({ invoice: invoice.paymentRequest });
  }

  async cancelHoldInvoice(paymentHash: string): Promise<void> {
    if (!this.client) throw new Error('Lightning not configured');
    await this.client.cancelHoldInvoice({ payment_hash: paymentHash });
  }

  async subscribeHoldInvoiceAccepted(paymentHash: string, onAccepted: (settleDeadline: number | null) => void): Promise<() => void> {
    if (!this.client) throw new Error('Lightning not configured');
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
