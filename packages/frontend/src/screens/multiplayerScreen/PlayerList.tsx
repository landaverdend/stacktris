import { PlayerInfo, WINS_TO_MATCH } from "../../../../shared/dist/protocol";
import { useRoom } from "../../context/RoomContext";
import { cn } from "../../lib/utils";
import { useConnection } from "../../ws/WSContext";



export function PlayerList() {
  const { roomState } = useRoom();
  const { playerId } = useConnection();

  return (
    < div className="flex flex-col items-center gap-3" >
      <span className="font-display font-bold text-4xl tracking-[0.02em] text-alert border-2! rounded-none! nerv-border nerv-border-alert px-2 ">PLAYERS</span>

      {
        roomState.players.map((p) => (
          <PlayerRow key={p.playerId} player={p} isYou={p.playerId === playerId} />
        ))
      }
    </div >
  )
}

function PlayerRow({ player, isYou }: { player: PlayerInfo; isYou: boolean }) {
  const pips = Array.from({ length: WINS_TO_MATCH }, (_, i) => i < player.wins ? '■' : '□').join('');
  const background = isYou
    ? 'linear-gradient(90deg, rgba(230,140,20,0.55), rgba(180,40,60,0.55), rgba(110,20,90,0.55))'
    : 'linear-gradient(90deg, rgba(230,140,20,0.25), rgba(180,40,60,0.25), rgba(110,20,90,0.25))';

  return (
    <div className="relative h-12 min-w-70">
      {/* Clipped background */}
      <div
        className="absolute inset-0"
        style={{
          background,
          clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
        }}
      />
      {/* Content */}
      <div className="relative flex items-center justify-between h-full px-5 gap-5">
        <div className="flex items-center gap-2">
          <div className="flex items-baseline gap-2">
            <span className={cn('font-display font-bold text-2xl tracking-[0.02em]', isYou ? 'text-phosphor' : 'text-phosphor')}>
              {player.playerName || player.playerId.slice(0, 8).toUpperCase()}
            </span>
            {isYou && <span className="font-jp text-[12px] font-bold text-[rgba(0,255,180,0.3)]">あなた</span>}
          </div>
          <span className="font-display text-sm tracking-widest text-magi">{pips}</span>
        </div>
        <span className={cn('font-display font-bold text-xl tracking-[0.02em]', player.ready ? 'text-magi' : 'text-phosphor/30')}>
          {player.ready ? '■ READY' : '◌ WAITING'}
        </span>
      </div>
    </div>
  );
}