import { PlayerInfo, WINS_TO_MATCH } from "../../../../shared/dist/protocol";
import { useRoom } from "../../context/RoomContext";
import { cn } from "../../lib/utils";
import { useConnection } from "../../ws/WSContext";



export function PlayerList() {
  const { roomState } = useRoom();
  const { playerId } = useConnection();

  return (
    < div className="flex flex-col items-center border border-nerv-dim rounded-md p-2" >
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
  return (
    <div className="flex items-center justify-between px-5 py-2.5 gap-5 ">

      <div className="flex items-center gap-2">
        <div className="flex items-baseline gap-2">
          <span className={cn("font-display font-bold text-2xl tracking-[0.02em]", isYou ? 'text-magi' : 'text-phosphor')}>
            {player.playerName || player.playerId.slice(0, 8).toUpperCase()}
          </span>
          {isYou && <span className="font-jp text-[12px] text-[rgba(0,255,180,0.3)]">あなた</span>}
        </div>

        <span className="font-display text-sm tracking-widest text-magi">{pips}</span>
      </div>


      <div className="flex items-center gap-3">
        <span className={cn('font-display font-bold text-xl tracking-[0.02em]', player.ready ? 'text-magi' : 'text-phosphor/30')}>
          {player.ready ? '■ READY' : '◌ WAITING'}
        </span>
      </div>
    </div>
  );
}