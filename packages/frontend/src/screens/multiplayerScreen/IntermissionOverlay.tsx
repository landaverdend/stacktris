import { PlayerInfo } from '@stacktris/shared';
import { truncateName } from '../../lib/utils';

interface Props {
  roundWinnerId: string | null;
  players: PlayerInfo[];
}

export function IntermissionOverlay({ roundWinnerId, players }: Props) {
  const winner = players.find(p => p.playerId === roundWinnerId);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
      <p className="text-nerv-dim text-xs font-mono tracking-[0.4em] uppercase">// SEQUENCE INTERMISSION</p>
      {winner && (
        <>
          <p className="text-phosphor font-display font-bold leading-none" style={{ fontSize: '3.5rem' }}>
            {truncateName(winner.playerName, 7)}
          </p>
          <p className="text-bitcoin font-display font-bold text-2xl tracking-widest uppercase">ROUND WIN</p>
        </>
      )}
      {!winner && (
        <p className="text-nerv-dim text-2xl font-mono tracking-[0.2em]">ROUND OVER</p>
      )}
      <p className="text-nerv-dim text-sm font-jp tracking-widest mt-1">シーケンス間</p>
    </div>
  );
}
