import { WINS_TO_MATCH } from '@stacktris/shared';
import { NervButton } from '../../components/NervButton';
import { SplitSessionState } from './useSplitSession';

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
            <span className="font-mono text-[11px] text-[rgba(0,255,180,0.4)] tracking-widest">
              {wins[pid] ?? 0}W
            </span>
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  session: SplitSessionState;
  onPlayAgain: () => void;
  onMainMenu: () => void;
};

export function SplitOverlay({ session, onPlayAgain, onMainMenu }: Props) {
  const { potSats, buyIn, snapshot } = session;
  const { status, roundId, roundWinnerId, matchWinnerId, countdown, wins, playerCount } = snapshot;

  if (status === 'intermission') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
        <div className="nerv-border bg-black px-12 py-10 flex flex-col items-center gap-8">
          <span className="font-mono text-[11px] tracking-widest text-[rgba(0,255,180,0.5)]">
            ROUND {roundId} COMPLETE
          </span>
          {roundWinnerId === null ? (
            <span className="font-display font-bold text-5xl tracking-[0.03em] text-phosphor">DRAW</span>
          ) : (
            <span className="font-display font-bold text-5xl tracking-[0.03em] text-phosphor">
              {roundWinnerId.replace('p', 'P')} WINS ROUND
            </span>
          )}
          <ScoreTable wins={wins} playerCount={playerCount} />
          <span className="font-mono text-[11px] tracking-widest text-[rgba(0,255,180,0.4)]">
            NEXT ROUND IN {countdown}
          </span>
        </div>
      </div>
    );
  }

  if (status === 'finished') {
    return (
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
            <NervButton onClick={onPlayAgain}>PLAY AGAIN</NervButton>
            <button
              onClick={onMainMenu}
              className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor/30 hover:text-alert transition-colors cursor-pointer text-center py-2">
              MAIN MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
