import { useEffect, useState } from 'react';
import { useRoom } from '../../context/SessionContext';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

const AMBER_GLOW = '0 0 8px rgba(255,112,32,0.7), 0 0 24px rgba(255,80,0,0.3)';
const MAGI_GLOW  = '0 0 8px rgba(0,255,136,0.6)';
const TERM_GLOW  = '0 0 6px rgba(0,255,65,0.6)';

const DIV = 'border-[rgba(247,147,26,0.18)]';

function InvoiceSkeleton() {
  return (
    <div className="flex-1 flex flex-col justify-center gap-3 animate-pulse px-3">
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-16 bg-amber/10 rounded-sm" />
          <div className="h-12 w-20 bg-amber/8 rounded-sm" />
          <div className="h-2.5 w-8 bg-amber/10 rounded-sm" />
        </div>
        <div className="border border-amber/10 p-1.5">
          <div className="w-[110px] h-[110px] bg-amber/5 flex items-center justify-center">
            <span className="font-mono text-[8px] tracking-[0.2em] text-amber/20">GENERATING…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RoomStagingOverlay() {
  const { roomState, readyUpdate } = useRoom();
  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [paymentSent, setPaymentSent] = useState(false);
  const hasWebLN = typeof (window as any).webln !== 'undefined';
  const { t } = useTranslation();

  const { bolt11, invoicePaid, buyIn, potSats } = roomState;
  const canReady    = buyIn === 0 || invoicePaid;
  const needsPayment = buyIn > 0 && !invoicePaid;

  useEffect(() => {
    if (roomState.status === 'waiting') setIsReady(false);
  }, [roomState.status]);

  const handleReady = () => {
    const next = !isReady;
    setIsReady(next);
    readyUpdate(next);
  };

  const copy = () => {
    if (!bolt11) return;
    navigator.clipboard.writeText(bolt11).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const pay = async () => {
    if (!bolt11) return;
    const webln = (window as any).webln;
    if (webln) {
      try {
        await webln.enable();
        // Don't await — hold invoices won't resolve until server settles.
        // Let the server's WebSocket update invoicePaid instead.
        webln.sendPayment(bolt11).catch(() => {});
        setPaymentSent(true);
      } catch {
        setQrExpanded(true);
      }
    } else {
      setQrExpanded(true);
    }
  };

  function statusLine() {
    if (!bolt11 && buyIn > 0)   return '> GENERATING_INVOICE...';
    if (!bolt11 && buyIn === 0)  return '> FREE_ENTRY — INITIATE_READY';
    if (paymentSent && !invoicePaid) return '> PAYMENT_SENT — HOLD_PENDING';
    if (needsPayment)            return '> AWAITING_PAYMENT';
    if (isReady)                 return '> OPERATOR_READY — STANDBY';
    if (invoicePaid)             return '> PAYMENT_CONFIRMED — INITIATE_READY';
    return '> FREE_ENTRY — INITIATE_READY';
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-black">

      {/* ── Header — mirrors clock header ── */}
      <div className={`flex items-center justify-between px-2 py-1.5 border-b ${DIV}`}>
        <span className="font-display font-bold text-sm tracking-[0.2em] text-amber/70">OP_STAGING</span>
        <div className="flex flex-col items-end gap-0.5">
          <span className="bg-amber text-black font-jp font-bold text-[18px] px-1.5 py-0.5 border-2 border-black/50 leading-tight tracking-wider">
            内部
          </span>
          <span className="font-mono text-[8px] tracking-[0.2em] text-amber/35">INTERNAL</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Pot row */}
        {buyIn > 0 && (
          <div className={`flex flex-col gap-0.5 px-3 py-2 border-b ${DIV}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[9px] tracking-[0.25em] text-amber/35">// CURRENT POT</span>
              <span className="font-mono text-[8px] tracking-[0.12em] text-amber/30">
                {potSats > 0
                  ? `${potSats / buyIn}/${roomState.players.length} ${t('staging.paid')}`
                  : t('staging.no_holds')}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <div className="relative">
                <span aria-hidden className="font-segment text-[44px] leading-none text-amber/8 absolute inset-0 select-none">
                  {'8'.repeat(Math.max(String(potSats).length, 1))}
                </span>
                <span className="font-segment text-[44px] leading-none text-amber relative" style={{ textShadow: AMBER_GLOW }}>
                  {potSats}
                </span>
              </div>
              <span className="font-display font-bold text-sm tracking-[0.3em] text-amber/50">SATS</span>
            </div>
          </div>
        )}

        {/* Invoice skeleton */}
        {needsPayment && !bolt11 && <InvoiceSkeleton />}

        {/* Invoice content */}
        {needsPayment && bolt11 && (
          <div className="flex-1 flex flex-col px-3 pt-2.5 pb-2 gap-2.5">
            {/* Amount */}
            <div className="flex flex-col items-center gap-1">
              <span className="bg-amber text-black font-jp font-bold text-[14px] px-1 py-0.5 border-2 border-black/50 leading-tight tracking-wider w-fit">
                即時送金
              </span>
              <div className="relative inline-block">
                <span aria-hidden className="font-segment text-[52px] leading-none text-amber/8 absolute inset-0 select-none pointer-events-none">
                  {'8'.repeat(String(buyIn).length)}
                </span>
                <span className="font-segment text-[52px] leading-none text-amber relative" style={{ textShadow: AMBER_GLOW }}>
                  {buyIn}
                </span>
              </div>
              <span className="font-mono text-[15px] tracking-[0.4em] text-amber/40">SATS</span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={copy}
                className="flex-1 py-1.5 font-display font-bold text-xs tracking-widest border border-amber/25 hover:border-amber/70 text-amber/55 hover:text-amber cursor-pointer transition-colors">
                {copied ? t('common.copied') : t('staging.copy_invoice')}
              </button>
              <button
                onClick={pay}
                className="flex-1 py-1.5 font-display font-bold text-xs tracking-widest border border-amber/25 hover:border-amber/70 text-amber/55 hover:text-amber cursor-pointer transition-colors">
                {hasWebLN ? t('staging.pay_wallet') : t('staging.show_qr')}
              </button>
              <button
                onClick={() => setQrExpanded(true)}
                title="Show QR code"
                className="px-2.5 py-1.5 border border-amber/25 hover:border-amber/70 text-amber/55 hover:text-amber cursor-pointer transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="1" width="5" height="5" />
                  <rect x="8" y="1" width="5" height="5" />
                  <rect x="1" y="8" width="5" height="5" />
                  <rect x="2.5" y="2.5" width="2" height="2" fill="currentColor" stroke="none" />
                  <rect x="9.5" y="2.5" width="2" height="2" fill="currentColor" stroke="none" />
                  <rect x="2.5" y="9.5" width="2" height="2" fill="currentColor" stroke="none" />
                  <rect x="9" y="9" width="1.5" height="1.5" fill="currentColor" stroke="none" />
                  <rect x="11" y="9" width="1.5" height="1.5" fill="currentColor" stroke="none" />
                  <rect x="9" y="11" width="1.5" height="1.5" fill="currentColor" stroke="none" />
                  <rect x="11" y="11" width="1.5" height="1.5" fill="currentColor" stroke="none" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Payment confirmed */}
        {invoicePaid && (
          <div className="flex-1 flex items-center justify-center px-3">
            <span className="font-display font-bold text-xl tracking-[0.1em] text-magi" style={{ textShadow: MAGI_GLOW }}>
              {t('staging.payment_confirmed')}
            </span>
          </div>
        )}

        {/* Free entry */}
        {buyIn === 0 && (
          <div className="flex-1 flex items-center justify-center px-3">
            <span className="font-mono text-[10px] tracking-[0.2em] text-amber/30">{t('staging.free_entry')}</span>
          </div>
        )}
      </div>

      {/* ── Terminal status — mirrors clock footer ── */}
      <div className={`flex items-center justify-between px-2 py-1.5 border-t ${DIV}`}>
        <span className="font-mono text-[10px] tracking-widest text-terminal" style={{ textShadow: TERM_GLOW }}>
          {statusLine()}<span className="terminal-blink">▌</span>
        </span>
      </div>

      {/* ── Ready button ── */}
      <button
        onClick={handleReady}
        disabled={!canReady}
        className={cn(
          'w-full py-2 font-display font-bold text-lg tracking-[0.15em] border-t-2 transition-all cursor-pointer disabled:cursor-not-allowed',
          !canReady  ? 'text-amber/15 border-amber/8'
          : isReady  ? 'text-magi border-magi/50'
                     : 'text-amber border-amber/50',
        )}>
        {!canReady ? t('staging.awaiting_payment') : isReady ? t('staging.cancel_ready') : t('staging.initiate_ready')}
      </button>

      {/* ── QR fullscreen ── */}
      {qrExpanded && bolt11 && (
        <button
          onClick={() => setQrExpanded(false)}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black cursor-pointer">
          <QRCodeSVG
            value={`lightning:${bolt11}`}
            size={Math.min(window.innerWidth, window.innerHeight) - 64}
            level="L"
            marginSize={3}
          />
          <span className="font-mono text-[10px] tracking-widest text-amber/50">{t('staging.tap_to_close')}</span>
        </button>
      )}
    </div>
  );
}
