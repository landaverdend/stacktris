import { useEffect, useState } from 'react';
import { useRoom } from '../../context/SessionContext';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

const AMBER_GLOW = '0 0 8px rgba(255,112,32,0.7), 0 0 24px rgba(255,80,0,0.3)';
const MAGI_GLOW  = '0 0 8px rgba(0,255,136,0.6)';

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
  const { roomState, serverError, readyUpdate } = useRoom();
  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);
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

        {/* Invoice skeleton / error */}
        {needsPayment && !bolt11 && !serverError && <InvoiceSkeleton />}
        {needsPayment && !bolt11 && serverError && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
            <span className="font-display font-bold text-sm tracking-[0.2em] text-alert">{t('staging.invoice_error_title')}</span>
            <p className="font-mono text-[11px] text-alert/60 leading-relaxed tracking-wide text-center">
              {t('staging.invoice_error_body')}
            </p>
          </div>
        )}

        {/* Invoice content */}
        {needsPayment && bolt11 && (
          <div className="flex-1 flex flex-col px-3 pt-2.5 pb-2 gap-2.5">
            {/* Amount */}
            <div className="flex flex-col items-center gap-1">
              <span className="bg-amber text-black font-jp font-bold text-[16px] px-1 py-0.5 border-2 border-black/50 leading-tight tracking-wider w-fit">
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
              <span className="font-mono text-[18px] tracking-[0.4em] text-amber/40">SATS</span>
            </div>

            {/* Hold invoice notice */}
            <div className="border-l-2 border-amber/30 pl-2 py-0.5 flex flex-col gap-1.5">
              <p className="font-mono text-[11px] text-amber/40 leading-relaxed tracking-wide">
                {t('staging.hold_notice')}
              </p>
              <div className="flex items-start gap-1.5">
                <span className="text-alert text-[11px] leading-none mt-[1px] shrink-0">!</span>
                <p className="font-mono text-[11px] text-alert/60 leading-relaxed tracking-wide">
                  {t('staging.disconnect_warning')}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={copy}
                className="flex-1 py-2 font-display font-bold text-base tracking-widest border border-amber/25 hover:border-amber/70 text-amber/55 hover:text-amber cursor-pointer transition-colors">
                {copied ? t('common.copied') : t('staging.copy_invoice')}
              </button>
              <button
                onClick={() => setQrExpanded(true)}
                title="Show QR code"
                className="px-3 py-2 border border-amber/25 hover:border-amber/70 text-amber/55 hover:text-amber cursor-pointer transition-colors">
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
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

            {/* Awaiting payment — disabled ready button */}
            <button
              disabled
              className="w-full py-4 flex items-center justify-center font-display font-bold text-2xl tracking-[0.2em] border-2 border-amber/8 text-amber/15 cursor-not-allowed mt-auto">
              {t('staging.awaiting_payment')}
            </button>
          </div>
        )}

        {/* Payment confirmed — ready button in center */}
        {invoicePaid && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
            <span className="font-display font-bold text-xl tracking-[0.1em] text-magi" style={{ textShadow: MAGI_GLOW }}>
              {t('staging.payment_confirmed')}
            </span>
            <button
              onClick={handleReady}
              style={{ textShadow: isReady ? MAGI_GLOW : AMBER_GLOW, boxShadow: isReady ? '0 0 18px rgba(0,255,136,0.15) inset' : '0 0 18px rgba(255,112,32,0.12) inset' }}
              className={cn(
                'w-full py-5 flex items-center justify-center font-display font-bold text-2xl tracking-[0.2em] border-2 transition-all cursor-pointer',
                isReady ? 'text-magi border-magi/50' : 'text-amber border-amber/50',
              )}>
              {isReady ? t('staging.cancel_ready') : t('staging.initiate_ready')}
            </button>
          </div>
        )}

        {/* Free entry — ready button in center */}
        {buyIn === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
            <span className="font-mono text-[10px] tracking-[0.2em] text-amber/30">{t('staging.free_entry')}</span>
            <button
              onClick={handleReady}
              style={{ textShadow: isReady ? MAGI_GLOW : AMBER_GLOW, boxShadow: isReady ? '0 0 18px rgba(0,255,136,0.15) inset' : '0 0 18px rgba(255,112,32,0.12) inset' }}
              className={cn(
                'w-full py-5 flex items-center justify-center font-display font-bold text-2xl tracking-[0.2em] border-2 transition-all cursor-pointer',
                isReady ? 'text-magi border-magi/50' : 'text-amber border-amber/50',
              )}>
              {isReady ? t('staging.cancel_ready') : t('staging.initiate_ready')}
            </button>
          </div>
        )}
      </div>

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
