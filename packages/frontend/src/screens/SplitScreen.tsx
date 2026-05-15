import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WINS_TO_MATCH } from '@stacktris/shared';
import { LocalArena, ARENA_WIDTH, ARENA_HEIGHT } from '../components/LocalArena';
import { LocalSession, LocalMatchSnapshot } from '../game/LocalSession';
import { LocalPaymentService } from '../game/LocalPaymentService';
import { NervButton } from '../components/NervButton';
import { PlayerCard } from '../components/PlayerCard';
import { cn } from '../lib/utils';
import { storage } from '../lib/storage';
import { CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE } from '../render/board';
import { HOLD_WIDTH, HOLD_HEIGHT, QUEUE_WIDTH, QUEUE_HEIGHT } from '../render/queue';
import { QRCodeSVG } from 'qrcode.react';

interface SplitSessionState {
  buyIn: number;
}

const MAX_PLAYERS = 8;
const GAP = 24;
const H_PADDING = 64;
const LABEL_H = 40;
const CARD_H = 72;

function useArenaScale(playerCount: number) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function update() {
      const available = window.innerWidth - H_PADDING;
      const natural = playerCount * ARENA_WIDTH + (playerCount - 1) * GAP;
      setScale(Math.min(1, available / natural));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [playerCount]);
  return scale;
}

function WinPips({ wins, target }: { wins: number; target: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: target }, (_, i) => (
        <span key={i} className={`text-sm ${i < wins ? 'text-teal' : 'text-phosphor/20'}`}>●</span>
      ))}
    </div>
  );
}

function ScoreTable({ wins, playerCount }: { wins: Record<string, number>; playerCount: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: playerCount }, (_, i) => {
        const pid = `p${i + 1}`;
        return (
          <div key={pid} className="flex items-center gap-4">
            <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor w-8">P{i + 1}</span>
            <WinPips wins={wins[pid] ?? 0} target={WINS_TO_MATCH} />
            <span className="font-mono text-[11px] text-[rgba(0,255,180,0.4)] tracking-widest">{wins[pid] ?? 0}W</span>
          </div>
        );
      })}
    </div>
  );
}

function LobbyArena({
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
}: {
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
}) {
  const scaledW = ARENA_WIDTH * scale;
  const scaledH = (ARENA_HEIGHT + LABEL_H + CARD_H + 8) * scale;

  const boardGrid = `
    repeating-linear-gradient(to right, transparent, transparent ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE}px),
    repeating-linear-gradient(to bottom, transparent, transparent ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE}px),
    #050505
  `;

  const showPaymentFlow = buyIn > 0;

  return (
    <div style={{ width: scaledW, height: scaledH, flexShrink: 0 }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: ARENA_WIDTH }}>
        <div className="flex items-start gap-2">
          <div className="nerv-border" style={{ width: HOLD_WIDTH, height: HOLD_HEIGHT, background: '#050505' }} />

          <div className="flex items-start gap-1">
            <div className="border rounded-md border-bitcoin/20" style={{ width: CELL_SIZE, height: CANVAS_HEIGHT, background: '#050505' }} />

            <div className="flex flex-col gap-1" style={{ width: CANVAS_WIDTH }}>
              <div
                className="relative nerv-border overflow-hidden"
                style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: boardGrid }}>
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 px-3">

                  {/* ── No-payment lobby ── */}
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

                  {/* ── Payment lobby ── */}
                  {showPaymentFlow && (
                    <>
                      <div className="flex flex-col items-center gap-0">
                        <span className="font-mono text-[9px] tracking-widest text-bitcoin/50">BUY IN</span>
                        <span className="font-segment text-3xl text-bitcoin">{buyIn}</span>
                        <span className="font-mono text-[9px] tracking-widest text-bitcoin/40">SATS</span>
                      </div>

                      {/* NWC not configured */}
                      {nwcMissing && (
                        <p className="font-mono text-[9px] text-alert/70 tracking-wider text-center leading-relaxed">
                          NWC not configured.{'\n'}Set it in Options.
                        </p>
                      )}

                      {/* Invoice error */}
                      {!nwcMissing && invoiceError && (
                        <p className="font-mono text-[9px] text-alert/70 tracking-wider text-center leading-relaxed">
                          Invoice error.{'\n'}Check NWC connection.
                        </p>
                      )}

                      {/* Generating invoice */}
                      {!nwcMissing && !invoiceError && !bolt11 && !paid && (
                        <span className="font-mono text-[9px] text-phosphor/40 tracking-widest animate-pulse">
                          GENERATING...
                        </span>
                      )}

                      {/* QR code — unpaid */}
                      {bolt11 && !paid && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="p-1.5 bg-white rounded">
                            <QRCodeSVG
                              value={`lightning:${bolt11}`}
                              size={CANVAS_WIDTH - 48}
                              level="M"
                            />
                          </div>
                          <span className="font-mono text-[8px] text-phosphor/30 tracking-widest">SCAN TO PAY</span>
                        </div>
                      )}

                      {/* Paid — show READY UP */}
                      {paid && (
                        <>
                          <span className="font-mono text-xs text-teal tracking-widest">✓ PAID</span>
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

              {/* Lightning address input (only when buy-in is active) */}
              {showPaymentFlow && (
                <input
                  type="text"
                  value={lightningAddress}
                  onChange={e => onLightningAddressChange(e.target.value)}
                  placeholder="you@wallet.domain"
                  className="w-full bg-transparent border-b border-[rgba(0,255,180,0.2)] text-teal font-mono text-[11px] text-center outline-none py-1 placeholder:text-phosphor/20 focus:border-teal/50 transition-colors"
                />
              )}

              <PlayerCard index={index} playerName={playerName} playerId={`p${index + 1}`} wins={wins} ready={ready} compact />
            </div>
          </div>

          <div className="nerv-border" style={{ width: QUEUE_WIDTH, height: QUEUE_HEIGHT, background: '#050505' }} />
        </div>
      </div>
    </div>
  );
}

export function SplitScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { buyIn } = (state as SplitSessionState) ?? { buyIn: 0 };

  const [playerCount, setPlayerCount] = useState(2);
  const [session, setSession] = useState(() => new LocalSession(2, buyIn));
  const [snapshot, setSnapshot] = useState<LocalMatchSnapshot>(() => session.snapshot);

  // Payment state
  const [invoices, setInvoices] = useState<Record<string, string | null>>({});
  const [invoiceErrors, setInvoiceErrors] = useState<Record<string, string | null>>({});
  const [lightningAddresses, setLightningAddresses] = useState<Record<string, string>>({});
  const [nwcMissing, setNwcMissing] = useState(false);
  const paymentServiceRef = useRef<LocalPaymentService | null>(null);

  const scale = useArenaScale(snapshot.playerCount);

  // Sync snapshot
  useEffect(() => {
    setSnapshot(session.snapshot);
    const unsub = session.subscribe(() => setSnapshot(session.snapshot));
    return () => {
      unsub();
      session.destroy();
    };
  }, [session]);

  // Payment service lifecycle — tied to session
  useEffect(() => {
    if (buyIn === 0) return;

    const nwcString = storage.get('nwcString');
    if (!nwcString) {
      setNwcMissing(true);
      return;
    }
    setNwcMissing(false);

    // Pre-fill p1 lightning address from storage
    const storedAddress = storage.get('lightningAddress');
    setLightningAddresses({ p1: storedAddress });

    const svc = new LocalPaymentService(nwcString, buyIn);
    paymentServiceRef.current = svc;

    const configs = session.snapshot.playerConfigs;
    setInvoices(Object.fromEntries(configs.map(c => [c.playerId, null])));
    setInvoiceErrors({});

    for (const config of configs) {
      const address = config.playerId === 'p1' ? storedAddress : '';
      svc.generateInvoice(config.playerId, address, () => {
        session.setPlayerPaid(config.playerId);
      }).then(bolt11 => {
        setInvoices(prev => ({ ...prev, [config.playerId]: bolt11 }));
      }).catch(err => {
        setInvoiceErrors(prev => ({ ...prev, [config.playerId]: String(err) }));
      });
    }

    return () => {
      svc.destroy();
      paymentServiceRef.current = null;
    };
  }, [session, buyIn]);

  // Trigger payout on match end
  useEffect(() => {
    const { status, matchWinnerId } = snapshot;
    if (status === 'finished' && matchWinnerId && paymentServiceRef.current) {
      paymentServiceRef.current.onMatchComplete(matchWinnerId).catch(console.error);
    }
  }, [snapshot.status, snapshot.matchWinnerId]);

  const newSession = useCallback((count: number) => {
    setPlayerCount(count);
    setSession(new LocalSession(count, buyIn));
  }, [buyIn]);

  const handleAddressChange = useCallback((playerId: string, addr: string) => {
    setLightningAddresses(prev => ({ ...prev, [playerId]: addr }));
    paymentServiceRef.current?.setLightningAddress(playerId, addr);
    session.setPlayerConfig(playerId, { lightningAddress: addr });
  }, [session]);

  const { status, games, roundId, wins, readyState, roundWinnerId, matchWinnerId, countdown, playerConfigs } = snapshot;
  const aliveCount = games.filter((_, i) => !games[i].state.isGameOver).length;
  const potSats = buyIn * snapshot.playerCount;

  return (
    <div className="flex flex-col items-center min-h-screen gap-6 px-8 pt-20">
      {/* Header */}
      <div className="flex items-center gap-6">
        {buyIn > 0 && <span className="font-mono text-sm text-bitcoin tracking-widest">BUY IN: {buyIn} SATS</span>}
        {status === 'playing' && (
          <span className="font-mono text-[11px] text-[rgba(0,255,180,0.4)] tracking-widest">{aliveCount} ALIVE</span>
        )}
        {status === 'lobby' && playerCount < MAX_PLAYERS && (
          <button
            onClick={() => newSession(playerCount + 1)}
            className="font-display font-bold text-xl tracking-[0.02em] text-phosphor/40 hover:text-teal transition-colors cursor-pointer border border-[rgba(0,255,180,0.2)] hover:border-teal px-4 py-1">
            + ADD PLAYER
          </button>
        )}
        {status !== 'finished' && (
          <button
            onClick={() => navigate('/')}
            className="font-display font-bold text-xl tracking-[0.02em] text-phosphor/30 hover:text-alert transition-colors cursor-pointer">
            ABORT
          </button>
        )}
      </div>

      {/* Lobby boards */}
      {status === 'lobby' && (
        <div className="flex items-start justify-center flex-wrap" style={{ gap: GAP * scale }}>
          {playerConfigs.map((config, i) => (
            <LobbyArena
              key={config.playerId}
              index={i}
              playerName={config.displayName}
              buyIn={buyIn}
              wins={wins[config.playerId] ?? 0}
              ready={readyState[config.playerId] ?? false}
              paid={config.paid}
              bolt11={invoices[config.playerId] ?? null}
              invoiceError={invoiceErrors[config.playerId] ?? null}
              nwcMissing={nwcMissing}
              lightningAddress={lightningAddresses[config.playerId] ?? ''}
              onLightningAddressChange={addr => handleAddressChange(config.playerId, addr)}
              onToggleReady={() => session.readyUp(config.playerId, !(readyState[config.playerId] ?? false))}
              scale={scale}
            />
          ))}
        </div>
      )}

      {/* Arenas */}
      {games.length > 0 && (
        <div className="flex items-start justify-center" style={{ gap: GAP * scale }}>
          {games.map((game, i) => {
            const pid = `p${i + 1}`;
            return (
              <LocalArena
                key={`${roundId}-${i}`}
                game={game}
                playerLabel={`P${i + 1}`}
                scale={scale}
                wins={wins[pid] ?? 0}
                winsTarget={WINS_TO_MATCH}
                paused={status === 'countdown'}
                showCountdown={status === 'countdown'}
                countdown={countdown}
                showWinAnimation={status === 'roundWinner' && roundWinnerId === pid}
                potSats={potSats}
              />
            );
          })}
        </div>
      )}

      {/* Intermission overlay */}
      {status === 'intermission' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
          <div className="nerv-border bg-black px-12 py-10 flex flex-col items-center gap-8">
            <span className="font-mono text-[11px] tracking-widest text-[rgba(0,255,180,0.5)]">ROUND {roundId} COMPLETE</span>
            {roundWinnerId === null ? (
              <span className="font-display font-bold text-5xl tracking-[0.03em] text-phosphor">DRAW</span>
            ) : (
              <span className="font-display font-bold text-5xl tracking-[0.03em] text-phosphor">
                {roundWinnerId.replace('p', 'P')} WINS ROUND
              </span>
            )}
            <ScoreTable wins={wins} playerCount={playerCount} />
            <span className="font-mono text-[11px] tracking-widest text-[rgba(0,255,180,0.4)]">NEXT ROUND IN {countdown}</span>
          </div>
        </div>
      )}

      {/* Match finished overlay */}
      {status === 'finished' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="nerv-border bg-black px-16 py-10 flex flex-col items-center gap-8">
            <span className="font-mono text-[11px] tracking-widest text-[rgba(0,255,180,0.5)]">MATCH COMPLETE</span>
            {matchWinnerId === null ? (
              <span className="font-display font-bold text-7xl tracking-[0.03em] text-phosphor">DRAW</span>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="font-display font-bold text-7xl tracking-[0.03em] text-phosphor">
                  {matchWinnerId.replace('p', 'P')}
                </span>
                <span className="font-mono text-[11px] tracking-widest text-teal">WINS THE MATCH</span>
                {buyIn > 0 && (
                  <span className="font-mono text-[11px] tracking-widest text-bitcoin mt-1">
                    PAYING OUT {potSats} SATS...
                  </span>
                )}
              </div>
            )}
            <ScoreTable wins={wins} playerCount={playerCount} />
            <div className="flex flex-col gap-3 w-64">
              <NervButton onClick={() => newSession(playerCount)}>PLAY AGAIN</NervButton>
              <button
                onClick={() => navigate('/')}
                className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor/30 hover:text-alert transition-colors cursor-pointer text-center py-2">
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
