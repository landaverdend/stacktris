import { useEffect, useState } from 'react';
import { useRoom } from '../../context/SessionContext';
import { QRCodeSVG } from 'qrcode.react';
import { launchPaymentModal } from '@getalby/bitcoin-connect-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

// ── Design tokens ─────────────────────────────────────────────────────────────

const AMBER_GLOW = '0 0 8px rgba(255,112,32,0.7), 0 0 24px rgba(255,80,0,0.3)';
const MAGI_GLOW = '0 0 10px rgba(0,255,136,0.6)';
const MAGI_GLOW_STR = '0 0 10px rgba(0,255,136,0.7)';
const TERMINAL_GLOW = '0 0 6px rgba(0,255,65,0.6)';

const HAZARD =
  'repeating-linear-gradient(45deg, rgba(180,0,0,0.55) 0px, rgba(180,0,0,0.55) 3px, transparent 3px, transparent 9px)';

function InvoiceSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      {/* Amount row skeleton */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-20 bg-amber/10 rounded-sm" />
          <div className="h-14 w-28 bg-amber/8 rounded-sm" />
          <div className="h-3 w-10 bg-amber/10 rounded-sm" />
        </div>
        {/* QR skeleton */}
        <div className="border border-amber/10 p-2 shrink-0">
          <div className="w-[148px] h-[148px] bg-amber/5 flex flex-col items-center justify-center gap-2">
            <span className="font-mono text-[9px] tracking-[0.3em] text-amber/20 uppercase">GENERATING</span>
            <span className="font-mono text-[9px] tracking-[0.3em] text-amber/20 uppercase">INVOICE...</span>
          </div>
        </div>
      </div>
      {/* Button skeletons */}
      <div className="flex gap-2 items-center">
        <div className="w-10 h-10 shrink-0 bg-amber/5 rounded-sm" />
        <div className="flex-1 h-9 bg-amber/8 rounded-sm" />
        <div className="flex-1 h-9 bg-amber/8 rounded-sm" />
      </div>
    </div>
  );
}

export function RoomStagingOverlay() {
  const { roomState, readyUpdate } = useRoom();
  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);
  const { t } = useTranslation();

  const { bolt11, invoicePaid, buyIn, potSats } = roomState;
  const canReady = buyIn === 0 || invoicePaid;
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

  const pay = () => {
    if (!bolt11) return;
    launchPaymentModal({ invoice: bolt11 });
  };

  function statusLine() {
    if (!bolt11 && buyIn > 0) return '> GENERATING_INVOICE...';
    if (!bolt11 && buyIn === 0) return '> FREE_ENTRY — INITIATE_READY';
    if (needsPayment) return '> AWAITING_PAYMENT';
    if (isReady) return '> OPERATOR_READY — STANDBY';
    if (invoicePaid) return '> PAYMENT_CONFIRMED — INITIATE_READY';
    return '> FREE_ENTRY — INITIATE_READY';
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-black/90">
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-[rgba(255,100,0,0.18)]"
        style={{ background: HAZARD }}>
        <div className="flex flex-col">
          <span
            className="font-display font-bold text-base tracking-[0.2em] text-amber w-fit bg-black p-2 border-nerv-dim border"
            style={{ textShadow: AMBER_GLOW }}>
            OP_STAGING
          </span>
        </div>

        {/* Internal badge */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="bg-amber text-black font-jp font-bold text-[24px] px-1.5 py-0.5 border-2 border-black/40 leading-tight tracking-wider">
            内部
          </span>
          <span className="font-mono text-[9px] tracking-[0.2em] text-amber/50">INTERNAL</span>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col px-4 pt-2 gap-4">
        <div className="flex-1 flex flex-col justify-center gap-4">
          {/* Pot */}
          {buyIn > 0 && (
            <div className="flex items-center justify-between border border-[rgba(255,100,0,0.25)] px-3 py-2 bg-[rgba(255,100,0,0.04)]">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] tracking-[0.3em] text-amber/40 uppercase">{t('staging.current_pot')}</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span
                    className="font-segment text-3xl leading-none text-amber"
                    style={{ textShadow: AMBER_GLOW }}>
                    {potSats}
                  </span>
                  <span className="font-display text-xs tracking-[0.3em] text-amber/50">SATS</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-mono text-[10px] tracking-[0.25em] text-amber/30">
                  {potSats > 0 ? `${potSats / buyIn}/${roomState.players.length} ${t('staging.paid')}` : t('staging.no_holds')}
                </span>
              </div>
            </div>
          )}

          {needsPayment && !bolt11 && <InvoiceSkeleton />}

          {needsPayment && bolt11 && (
            <div className="flex flex-col gap-4">
              {/* Amount row */}
              <div className="flex flex-wrap items-end justify-between gap-3 min-w-0">
                <div className="flex flex-col min-w-0">
                  <span className="bg-amber text-black font-jp font-bold text-[16px] px-1.5 py-0.5 border-2 border-black/40 leading-tight tracking-wider inline-block w-fit mb-1">即時送金</span>
                  <div className="relative inline-block leading-none">
                    {/* Ghost segments — all segments on, very dim */}
                    <span
                      aria-hidden
                      className="font-segment text-[56px] leading-none text-amber/4 absolute inset-0 select-none">
                      {'8'.repeat(String(buyIn).length)}
                    </span>
                    {/* Active segments */}
                    <span
                      className="font-segment text-[56px] leading-none text-amber relative"
                      style={{ textShadow: AMBER_GLOW }}>
                      {buyIn}
                    </span>
                  </div>
                  <span className="font-display text-sm tracking-[0.4em] text-amber/50 mt-1">SATS</span>
                </div>
                {/* QR code */}
                <button
                  onClick={() => setQrExpanded(true)}
                  className="border border-[rgba(255,100,0,0.3)] p-2 bg-white shrink-0 cursor-pointer hover:border-[rgba(255,100,0,0.8)] transition-colors max-w-full">
                  <QRCodeSVG value={`lightning:${bolt11}`} size={130} level="L" marginSize={2} />
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 items-center">
                <div className="group relative shrink-0">
                  <span className="font-mono text-4xl text-alert cursor-default select-none hover:text-alert/70 transition-colors">⚠</span>
                  <div className="absolute bottom-full left-0 mb-2 w-56 hidden group-hover:block z-10">
                    <div className="bg-black border border-[rgba(255,100,0,0.4)] px-3 py-2">
                      <p className="font-mono text-[15px] tracking-wide text-amber/70 leading-relaxed">
                        {t('staging.notice')}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={copy}
                  className="flex-1 py-2 font-display font-bold text-sm tracking-widest border border-[rgba(255,100,0,0.35)] hover:border-[rgba(255,100,0,0.9)] text-amber cursor-pointer transition-colors">
                  {copied ? t('common.copied') : t('staging.copy_invoice')}
                </button>
                <button
                  onClick={pay}
                  className="flex-1 py-2 font-display font-bold text-sm tracking-widest border border-[rgba(255,100,0,0.35)] hover:border-[rgba(255,100,0,0.9)] text-amber cursor-pointer transition-colors">
                  {t('staging.pay_wallet')}
                </button>
              </div>
            </div>
          )}

          {invoicePaid && (
            <div className="flex flex-col items-center gap-1 py-2">
              <span
                className="font-display font-bold text-2xl tracking-[0.1em] text-magi"
                style={{ textShadow: MAGI_GLOW }}>
                {t('staging.payment_confirmed')}
              </span>
            </div>
          )}

          {buyIn === 0 && (
            <div className="flex flex-col items-center gap-0.5 py-2">
              <span className="font-mono text-xs tracking-[0.15em] text-amber/35">{t('staging.free_entry')}</span>
            </div>
          )}
        </div>
        {/* end centered content */}
      </div>

      {/* ── Terminal status line ── */}
      <div className="px-3 py-2 border-t border-[rgba(255,100,0,0.12)]">
        <span className="font-mono text-xs tracking-widest text-terminal" style={{ textShadow: TERMINAL_GLOW }}>
          {statusLine()}
          <span className="terminal-blink">▌</span>
        </span>
      </div>

      {/* ── QR fullscreen ── */}
      {qrExpanded && bolt11 && (
        <button
          onClick={() => setQrExpanded(false)}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black cursor-pointer">
          <QRCodeSVG value={`lightning:${bolt11}`} size={Math.min(window.innerWidth, window.innerHeight) - 64} level="L" marginSize={3} />
          <span className="font-mono text-[10px] tracking-widest text-[rgba(255,100,0,0.5)]">{t('staging.tap_to_close')}</span>
        </button>
      )}

      {/* ── Ready button ── */}
      <button
        onClick={handleReady}
        disabled={!canReady}
        className={cn(
          'w-full py-3 font-display font-bold text-2xl tracking-[0.15em] border-t-2 transition-all cursor-pointer disabled:cursor-not-allowed',
          !canReady ? 'text-amber/15 border-amber/8' : isReady ? 'text-[#00ff88] border-[#00ff88]/50' : 'text-amber border-amber/50',
        )}
        style={{
          background: HAZARD,
          textShadow: !canReady ? 'none' : isReady ? MAGI_GLOW_STR : AMBER_GLOW,
        }}>
        <span className="bg-black p-2 border-nerv-dim border">
          {!canReady ? t('staging.awaiting_payment') : isReady ? t('staging.cancel_ready') : t('staging.initiate_ready')}
        </span>
      </button>
    </div>
  );
}
