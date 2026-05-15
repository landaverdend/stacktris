import { useState, useEffect, useRef } from 'react';
import { PendingGarbage } from '@stacktris/shared';
import { GarbageMeter } from '../../components/GarbageMeter';
import { PlayerCard } from '../../components/PlayerCard';
import { cn } from '../../lib/utils';
import { CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE } from '../../render/board';
import { HOLD_WIDTH, HOLD_HEIGHT, QUEUE_WIDTH, QUEUE_HEIGHT } from '../../render/queue';
import { QRCodeSVG } from 'qrcode.react';
import { ARENA_WIDTH } from '../../components/LocalArena';

type VerifyStatus = 'idle' | 'checking' | 'ok' | 'invalid' | 'cors';

type Props = {
  index: number;
  playerName: string;
  buyIn: number;
  wins: number;
  ready: boolean;
  paid: boolean;
  bolt11: string | null;
  invoiceError: string | null;
  nwcMissing: boolean;
  lightningAddress: string;
  onLightningAddressChange: (addr: string) => void;
  onToggleReady: () => void;
  scale: number;
};

export function LobbyArena({
  index,
  playerName,
  buyIn,
  wins,
  ready,
  paid,
  bolt11,
  invoiceError,
  nwcMissing,
  lightningAddress,
  onLightningAddressChange,
  onToggleReady,
  scale,
}: Props) {
  const emptyGarbageRef = useRef<PendingGarbage[]>([]);
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');

  useEffect(() => {
    setVerifyStatus('idle');
  }, [lightningAddress]);

  const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lightningAddress);

  async function handleVerify() {
    if (!isValidFormat) {
      setVerifyStatus('invalid');
      return;
    }
    setVerifyStatus('checking');
    const [user, domain] = lightningAddress.split('@');
    try {
      const res = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
      if (!res.ok) {
        setVerifyStatus('invalid');
        return;
      }
      const json = await res.json();
      setVerifyStatus(json?.tag === 'payRequest' ? 'ok' : 'invalid');
    } catch {
      setVerifyStatus('cors');
    }
  }

  const scaledW = ARENA_WIDTH * scale;
  const arenaScaledH = CANVAS_HEIGHT * scale;
  const showPaymentFlow = buyIn > 0;

  const boardGrid = `
    repeating-linear-gradient(to right, transparent, transparent ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE}px),
    repeating-linear-gradient(to bottom, transparent, transparent ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE}px),
    #050505
  `;

  return (
    <div style={{ width: scaledW, flexShrink: 0 }}>
      {/* Scaled section — only arena canvases */}
      <div style={{ height: arenaScaledH, overflow: 'hidden' }}>
        <div
          style={{
            transform: `scale(${scale}) translateZ(0)`,
            transformOrigin: 'top left',
            width: ARENA_WIDTH,
            willChange: 'transform',
          }}>
          <div className="flex items-start gap-2">
            <div className="nerv-border" style={{ width: HOLD_WIDTH, height: HOLD_HEIGHT, background: '#050505' }} />

            <div className="flex items-start gap-1">
              <GarbageMeter garbageStackRef={emptyGarbageRef} getCurrentTick={() => 0} />

              <div
                className="relative nerv-border overflow-hidden"
                style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: boardGrid }}>
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 px-3">
                  {!showPaymentFlow && (
                    <button
                      onClick={onToggleReady}
                      className={cn(
                        'px-6 py-3 font-display font-bold text-xl tracking-[0.15em] border-2 transition-all cursor-pointer',
                        ready
                          ? 'border-teal text-teal'
                          : 'border-phosphor/30 text-phosphor/50 hover:border-phosphor/60 hover:text-phosphor/80',
                      )}>
                      {ready ? '✓ READY' : 'READY UP'}
                    </button>
                  )}

                  {showPaymentFlow && (
                    <>
                      <div className="flex flex-col items-center gap-0">
                        <span className="font-display font-bold text-sm tracking-[0.02em] text-bitcoin/50">BUY IN</span>
                        <span className="font-segment text-3xl text-bitcoin">{buyIn}</span>
                        <span className="font-display font-bold text-sm tracking-[0.02em] text-bitcoin/40">SATS</span>
                      </div>

                      {nwcMissing && (
                        <p className="font-display font-bold text-sm tracking-[0.02em] text-alert/80 text-center leading-snug">
                          NWC NOT CONFIGURED{'\n'}SET IN OPTIONS
                        </p>
                      )}

                      {!nwcMissing && invoiceError && (
                        <p className="font-display font-bold text-sm tracking-[0.02em] text-alert/80 text-center leading-snug">
                          INVOICE ERROR{'\n'}CHECK NWC CONNECTION
                        </p>
                      )}

                      {!nwcMissing && !invoiceError && !bolt11 && !paid && (
                        <span className="font-display font-bold text-sm tracking-[0.02em] text-phosphor/40 animate-pulse">
                          GENERATING...
                        </span>
                      )}

                      {bolt11 && !paid && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="p-1.5 bg-white rounded">
                            <QRCodeSVG value={`lightning:${bolt11}`} size={CANVAS_WIDTH - 48} level="M" />
                          </div>
                          <span className="font-display font-bold text-xs tracking-[0.02em] text-phosphor/40">SCAN TO PAY</span>
                        </div>
                      )}

                      {paid && (
                        <>
                          <span className="font-display font-bold text-sm tracking-[0.02em] text-teal">✓ PAID</span>
                          <button
                            onClick={onToggleReady}
                            className={cn(
                              'px-6 py-3 font-display font-bold text-xl tracking-[0.15em] border-2 transition-all cursor-pointer',
                              ready
                                ? 'border-teal text-teal'
                                : 'border-phosphor/30 text-phosphor/50 hover:border-phosphor/60 hover:text-phosphor/80',
                            )}>
                            {ready ? '✓ READY' : 'READY UP'}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="nerv-border" style={{ width: QUEUE_WIDTH, height: QUEUE_HEIGHT, background: '#050505' }} />
          </div>
        </div>
      </div>

      {/* Native-scale content — no transform blurriness */}
      {showPaymentFlow && (
        <div
          style={{ width: Math.round(CANVAS_WIDTH * scale), marginLeft: 'auto', marginRight: 'auto' }}
          className="flex items-baseline gap-3 pt-2 border-t border-[rgba(255,112,32,0.12)]">
          <span className="font-display font-bold text-sm tracking-[0.15em] text-phosphor/50 shrink-0">PAYOUT</span>
          <input
            type="text"
            value={lightningAddress}
            onChange={(e) => onLightningAddressChange(e.target.value)}
            placeholder="you@wallet.domain"
            className="flex-1 bg-transparent border-b border-[rgba(255,112,32,0.35)] text-bitcoin font-display text-base outline-none pb-px placeholder:text-phosphor/20 focus:border-bitcoin/70 transition-colors min-w-0"
          />
          <button
            onClick={handleVerify}
            disabled={!lightningAddress.trim() || verifyStatus === 'checking'}
            className={cn(
              'font-display font-bold text-sm tracking-[0.15em] shrink-0 cursor-pointer disabled:opacity-30',
              verifyStatus === 'ok'
                ? 'text-teal'
                : verifyStatus === 'invalid'
                  ? 'text-alert'
                  : verifyStatus === 'cors'
                    ? 'text-bitcoin'
                    : 'text-phosphor/40 hover:text-phosphor/70',
            )}>
            {verifyStatus === 'checking'
              ? '···'
              : verifyStatus === 'ok'
                ? '✓ OK'
                : verifyStatus === 'invalid'
                  ? '✗ BAD'
                  : 'PING'}
          </button>
        </div>
      )}

      <div className="w-fit mx-auto mt-1">
        <PlayerCard index={index} playerName={playerName} playerId={`p${index + 1}`} wins={wins} ready={ready} />
      </div>
    </div>
  );
}
