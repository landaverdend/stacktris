import { LocalArena } from '../../components/LocalArena';
import { WINS_TO_MATCH } from '@stacktris/shared';
import { SplitSessionState } from './useSplitSession';
import { ARENA_GAP } from './constants';

type Props = {
  session: SplitSessionState;
  scale: number;
};

export function SplitBoards({ session, scale }: Props) {
  const { snapshot, lightningAddresses, showIntermission, intermissionPlayers } = session;
  const { status, games, roundId, wins, countdown, roundWinnerId } = snapshot;

  return (
    <div className="flex items-start justify-center" style={{ gap: ARENA_GAP * scale }}>
      {games.map((game, i) => {
        const pid = `p${i + 1}`;
        const addr = lightningAddresses[pid] ?? '';
        return (
          <div key={`${roundId}-${i}`} className="flex flex-col items-center">
            <LocalArena
              game={game}
              playerLabel={`P${i + 1}`}
              scale={scale}
              wins={wins[pid] ?? 0}
              winsTarget={WINS_TO_MATCH}
              paused={status !== 'playing'}
              showCountdown={status === 'countdown'}
              countdown={countdown}
              showIntermission={showIntermission}
              isRoundWinner={showIntermission && roundWinnerId === pid}
              roundWinnerId={roundWinnerId}
              intermissionPlayers={intermissionPlayers}
            />
            {addr && (
              <span className="font-display text-sm tracking-[0.08em] text-bitcoin/50 mt-1">{addr}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
