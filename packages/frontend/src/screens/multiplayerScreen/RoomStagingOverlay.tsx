import { useEffect, useState } from 'react';
import { useRoom } from '../../context/SessionContext';
import { QRCodeSVG } from 'qrcode.react';
import { launchPaymentModal } from '@getalby/bitcoin-connect-react';
// Complex CSS values that can't be expressed in Tailwind
const AMBER_GLOW = '0 0 8px rgba(255,112,32,0.7), 0 0 24px rgba(255,80,0,0.3)';
const HAZARD =
  'repeating-linear-gradient(45deg, rgba(180,0,0,0.55) 0px, rgba(180,0,0,0.55) 3px, transparent 3px, transparent 9px)';

export function RoomStagingOverlay() {
  const { roomState, readyUpdate } = useRoom();
  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);

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
            className="font-display font-bold text-base tracking-[0.2em] text-[#ff7020] w-fit bg-black p-2 border-nerv-dim border"
            style={{ textShadow: AMBER_GLOW }}>
            OP_STAGING
          </span>
        </div>

        {/* Internal badge */}
        <div className="flex flex-col items-end border border-[rgba(255,100,0,0.45)] px-2 py-1 bg-black">
          <span className="font-jp font-bold text-xs text-[#ff7020]">内部</span>
          <span className="font-display font-bold text-xs tracking-widest text-[#ff7020]/60">INTERNAL</span>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col px-4 pt-2 gap-4">
        <div className="flex-1 flex flex-col justify-center gap-4">
          {/* Pot */}
          {buyIn > 0 && (
            <div className="flex items-center justify-between border border-[rgba(255,100,0,0.25)] px-3 py-2 bg-[rgba(255,100,0,0.04)]">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] tracking-[0.3em] text-[#ff7020]/40 uppercase">// Current Pot</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span
                    className="font-segment text-3xl leading-none text-[#ff7020]"
                    style={{ textShadow: AMBER_GLOW }}>
                    {potSats}
                  </span>
                  <span className="font-display text-xs tracking-[0.3em] text-[#ff7020]/50">SATS</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-mono text-[10px] tracking-[0.25em] text-[#ff7020]/30">{potSats > 0 ? `${potSats / buyIn}/${roomState.players.length} PAID` : 'NO HOLDS YET'}</span>
              </div>
            </div>
          )}

          {needsPayment && (
            <div className="flex flex-col gap-4">
              {/* Amount row */}
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col">
                  <span className="font-mono text-[12px] tracking-[0.2em] text-[#ff7020]/40 mb-1">即時送金</span>
                  <div className="relative inline-block leading-none">
                    {/* Ghost segments — all segments on, very dim */}
                    <span
                      aria-hidden
                      className="font-segment text-[56px] leading-none text-[#ff7020]/4 absolute inset-0 select-none">
                      {'8'.repeat(String(buyIn).length)}
                    </span>
                    {/* Active segments */}
                    <span
                      className="font-segment text-[56px] leading-none text-[#ff7020] relative"
                      style={{ textShadow: AMBER_GLOW }}>
                      {buyIn}
                    </span>
                  </div>
                  <span className="font-display text-sm tracking-[0.4em] text-[#ff7020]/50 mt-1">SATS</span>
                </div>
                {/* QR code */}
                <button
                  onClick={() => bolt11 && setQrExpanded(true)}
                  disabled={!bolt11}
                  className="border border-[rgba(255,100,0,0.3)] p-2 bg-white shrink-0 cursor-pointer disabled:cursor-default hover:border-[rgba(255,100,0,0.8)] transition-colors">
                  {bolt11 ? (
                    <QRCodeSVG value={`lightning:${bolt11}`} size={148} level="L" marginSize={2} />
                  ) : (
                    <div className="w-[148px] h-[148px] bg-[rgba(255,100,0,0.06)] animate-pulse" />
                  )}
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 items-center">
                <div className="group relative shrink-0">
                  <span className="font-mono text-4xl text-alert cursor-default select-none hover:text-alert/70 transition-colors">⚠</span>
                  <div className="absolute bottom-full left-0 mb-2 w-56 hidden group-hover:block z-10">
                    <div className="bg-black border border-[rgba(255,100,0,0.4)] px-3 py-2">
                      <p className="font-mono text-[15px] tracking-wide text-[#ff7020]/70 leading-relaxed">
                        NOTICE: Disconnecting during an active match will result in immediate forfeiture of staked funds.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={copy}
                  disabled={!bolt11}
                  className="flex-1 py-2 font-display font-bold text-sm tracking-widest border border-[rgba(255,100,0,0.35)] hover:border-[rgba(255,100,0,0.9)] text-[#ff7020] cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                  {copied ? '✓ COPIED' : 'COPY INVOICE'}
                </button>
                <button
                  onClick={pay}
                  disabled={!bolt11}
                  className="flex-1 py-2 font-display font-bold text-sm tracking-widest border border-[rgba(255,100,0,0.35)] hover:border-[rgba(255,100,0,0.9)] text-[#ff7020] cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                  PAY WALLET
                </button>
              </div>
            </div>
          )}

          {invoicePaid && (
            <div className="flex flex-col items-center gap-1 py-2">
              <span
                className="font-display font-bold text-2xl tracking-[0.1em] text-magi"
                style={{ textShadow: '0 0 10px rgba(0,255,136,0.6)' }}>
                ■ PAYMENT CONFIRMED
              </span>
            </div>
          )}

          {buyIn === 0 && (
            <div className="flex flex-col items-center gap-0.5 py-2">
              <span className="font-mono text-xs tracking-[0.15em] text-[#ff7020]/35">// FREE ENTRY — NO PAYMENT REQUIRED</span>
            </div>
          )}
        </div>
        {/* end centered content */}
      </div>

      {/* ── Terminal status line ── */}
      <div className="px-3 py-2 border-t border-[rgba(255,100,0,0.12)]">
        <span className="font-mono text-xs tracking-widest text-terminal" style={{ textShadow: '0 0 6px rgba(0,255,65,0.6)' }}>
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
          <span className="font-mono text-[10px] tracking-widest text-[rgba(255,100,0,0.5)]">TAP TO CLOSE</span>
        </button>
      )}

      {/* ── Ready button ── */}
      <button
        onClick={handleReady}
        disabled={!canReady}
        className="w-full py-3 font-display font-bold text-2xl tracking-[0.15em] border-t-2 transition-all cursor-pointer disabled:cursor-not-allowed"
        style={{
          background: HAZARD,
          color: !canReady ? 'rgba(255,112,32,0.15)' : isReady ? '#00ff88' : '#ff7020',
          borderColor: !canReady ? 'rgba(255,100,0,0.08)' : isReady ? 'rgba(0,255,136,0.5)' : 'rgba(255,100,0,0.5)',
          textShadow: !canReady ? 'none' : isReady ? '0 0 10px rgba(0,255,136,0.7)' : AMBER_GLOW,
        }}>
        <span className="bg-black p-2 border-nerv-dim border">
          {!canReady ? 'AWAITING PAYMENT' : isReady ? '■ CANCEL READY' : '◌ INITIATE READY'}
        </span>
      </button>
    </div>
  );
}
