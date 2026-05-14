import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WINS_TO_MATCH } from '@stacktris/shared';
import { LocalArena, ARENA_WIDTH, ARENA_HEIGHT } from '../components/LocalArena';
import { LocalSession, LocalMatchSnapshot } from '../game/LocalSession';
import { NervButton } from '../components/NervButton';
import { PlayerCard } from '../components/PlayerCard';
import { cn } from '../lib/utils';
import { CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE } from '../render/board';
import { HOLD_WIDTH, HOLD_HEIGHT, QUEUE_WIDTH, QUEUE_HEIGHT } from '../render/queue';

interface SplitSessionState {
  buyIn: number;
}

const MAX_PLAYERS = 8;
const GAP = 24;
const H_PADDING = 64;
const LABEL_H = 40;
const CARD_H = 72; // player card + accent bar

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
        <span key={i} className={`text-sm ${i < wins ? 'text-teal' : 'text-phosphor/20'}`}>
          ●
        </span>
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
  onToggleReady,
  scale,
}: {
  index: number;
  playerName: string;
  buyIn: number;
  wins: number;
  ready: boolean;
  onToggleReady: () => void;
  scale: number;
}) {
  const scaledW = ARENA_WIDTH * scale;
  const scaledH = (ARENA_HEIGHT + LABEL_H + CARD_H + 8) * scale;

  // CSS grid drawn at CELL_SIZE intervals to mimic an empty board
  const boardGrid = `
    repeating-linear-gradient(to right, transparent, transparent ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE}px),
    repeating-linear-gradient(to bottom, transparent, transparent ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE - 1}px, rgba(255,255,255,0.03) ${CELL_SIZE}px),
    #050505
  `;

  return (
    <div style={{ width: scaledW, height: scaledH, flexShrink: 0 }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: ARENA_WIDTH }}>
        <div className="flex items-start gap-2">
          {/* Hold placeholder */}
          <div className="nerv-border" style={{ width: HOLD_WIDTH, height: HOLD_HEIGHT, background: '#050505' }} />

          <div className="flex items-start gap-1">
            {/* Garbage meter placeholder */}
            <div
              className="border rounded-md border-bitcoin/20"
              style={{ width: CELL_SIZE, height: CANVAS_HEIGHT, background: '#050505' }}
            />

            {/* Board column: board above, card below */}
            <div className="flex flex-col gap-1" style={{ width: CANVAS_WIDTH }}>
              {/* Board with READY overlay */}
              <div
                className="relative nerv-border overflow-hidden"
                style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: boardGrid }}>
                <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-5">
                  {buyIn > 0 && (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-mono text-[9px] tracking-widest text-bitcoin/50">BUY IN</span>
                      <span className="font-segment text-4xl text-bitcoin">{buyIn}</span>
                      <span className="font-mono text-[9px] tracking-widest text-bitcoin/40">SATS</span>
                    </div>
                  )}
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
                </div>
              </div>

              <PlayerCard index={index} playerName={playerName} playerId={`p${index + 1}`} wins={wins} ready={ready} compact />
            </div>
          </div>

          {/* Queue placeholder */}
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
  const [session, setSession] = useState(() => new LocalSession(2));
  const [snapshot, setSnapshot] = useState<LocalMatchSnapshot>(() => session.snapshot);

  const scale = useArenaScale(snapshot.playerCount);

  useEffect(() => {
    setSnapshot(session.snapshot);
    const unsub = session.subscribe(() => setSnapshot(session.snapshot));
    return () => {
      unsub();
      session.destroy();
    };
  }, [session]);

  const newSession = useCallback((count: number) => {
    setPlayerCount(count);
    setSession(new LocalSession(count));
  }, []);

  const { status, games, roundId, wins, readyState, roundWinnerId, matchWinnerId, countdown } = snapshot;
  const aliveCount = games.filter((_, i) => status === 'playing' && !games[i].state.isGameOver).length;
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
          {Array.from({ length: playerCount }, (_, i) => {
            const pid = `p${i + 1}`;
            return (
              <LobbyArena
                key={pid}
                index={i}
                playerName={`P${i + 1}`}
                buyIn={buyIn}
                wins={wins[pid] ?? 0}
                ready={readyState[pid] ?? false}
                onToggleReady={() => session.readyUp(pid, !(readyState[pid] ?? false))}
                scale={scale}
              />
            );
          })}
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
