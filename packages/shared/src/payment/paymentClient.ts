import { NWCClient } from '@getalby/sdk';

/**
 * Wraps NWCClient with game-specific payment operations.
 *
 * NOTE: NWCClient requires a global `WebSocket`. In Node.js environments the
 * caller must polyfill it before constructing this class, e.g.:
 *   import { WebSocket } from 'ws';
 *   globalThis.WebSocket ??= WebSocket;
 */
export class PaymentClient {
  private client: NWCClient | null;

  constructor(nwcString?: string) {
    this.client = nwcString
      ? new NWCClient({ nostrWalletConnectUrl: nwcString })
      : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async init(): Promise<void> {
    if (!this.client) {
      console.warn('[nwc] NWC string not set — Lightning payments disabled');
      return;
    }
    const info = await this.client.getInfo();
    console.log('[nwc] connected:', info);
  }

  async generateHoldInvoice(amountSats: number, description: string) {
    if (!this.client) throw new Error('Lightning not configured');
    const preimage = crypto.getRandomValues(new Uint8Array(32));
    const hashBuffer = await crypto.subtle.digest('SHA-256', preimage);
    const paymentHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const result = await this.client.makeHoldInvoice({
      amount: amountSats * 1000,
      description,
      payment_hash: paymentHash,
      expiry: 86400,
    });
    return { invoice: result.invoice, paymentHash, preimage, expiresAt: result.expires_at * 1000 };
  }

  async settleHoldInvoice(preimage: Uint8Array): Promise<void> {
    if (!this.client) throw new Error('Lightning not configured');
    const preimageHex = Array.from(preimage).map(b => b.toString(16).padStart(2, '0')).join('');
    await this.client.settleHoldInvoice({ preimage: preimageHex });
  }

  async cancelHoldInvoice(paymentHash: string): Promise<void> {
    if (!this.client) throw new Error('Lightning not configured');
    await this.client.cancelHoldInvoice({ payment_hash: paymentHash });
  }

  async subscribeHoldInvoiceAccepted(
    paymentHash: string,
    onAccepted: (settleDeadline: number | null) => void,
  ): Promise<() => void> {
    if (!this.client) throw new Error('Lightning not configured');
    return this.client.subscribeNotifications((notification) => {
      if (
        notification.notification_type === 'hold_invoice_accepted' &&
        notification.notification.payment_hash === paymentHash
      ) {
        onAccepted(notification.notification.settle_deadline ?? null);
      }
    }, ['hold_invoice_accepted']);
  }

  async payToLightningAddress(lightningAddress: string, amountSats: number): Promise<void> {
    if (!this.client) throw new Error('Lightning not configured');
    const { LightningAddress } = await import('@getalby/lightning-tools');
    const ln = new LightningAddress(lightningAddress);
    await ln.fetch();
    const invoice = await ln.requestInvoice({ satoshi: amountSats });
    await this.client.payInvoice({ invoice: invoice.paymentRequest });
  }

  close(): void {
    this.client?.close();
    this.client = null;
  }
}
