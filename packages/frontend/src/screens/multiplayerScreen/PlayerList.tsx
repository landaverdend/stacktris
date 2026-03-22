import { PlayerInfo, WINS_TO_MATCH } from "../../../../shared/dist/protocol";
import { useRoom } from "../../context/RoomContext";
import { cn } from "../../lib/utils";
import { useConnection } from "../../ws/WSContext";



export function PlayerList() {
  const { roomState } = useRoom();
  const { playerId } = useConnection();

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="font-display font-bold text-4xl tracking-[0.02em] text-alert border-2! rounded-none! nerv-border nerv-border-alert px-2">PLAYERS</span>

      {roomState.players.map((p, i) => (
        <PlayerRow key={p.playerId} player={p} isYou={p.playerId === playerId} index={i} />
      ))}
    </div>
  )
}

const ORANGE_GLOW = '0 0 6px #ff7020, 0 0 18px rgba(255,100,20,0.5)';

function PlayerRow({ player, isYou, index }: { player: PlayerInfo; isYou: boolean; index: number }) {
  const pips = Array.from({ length: WINS_TO_MATCH }, (_, i) => i < player.wins ? '■' : '□').join('');
  const alpha = isYou ? 0.55 : 0.28;
  const background = `linear-gradient(90deg, rgba(230,140,20,${alpha}), rgba(180,40,60,${alpha}), rgba(110,20,90,${alpha}))`;
  const accentAlpha = isYou ? 0.4 : 0.18;
  const accent = `linear-gradient(90deg, rgba(230,140,20,${accentAlpha}), rgba(180,40,60,${accentAlpha}), rgba(110,20,90,${accentAlpha}))`;

  return (
    <div className="flex flex-col gap-1 min-w-72">
      {/* Main bar */}
      <div className="relative h-12">
        <div className="absolute inset-0" style={{ background, clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)' }} />
        <div className="relative flex items-center h-full px-4 gap-3">
          {/* Glowy index number */}
          <div className="flex flex-col items-start -mr-1">
            <span className="font-display font-bold leading-none" style={{ fontSize: '9px', color: '#ff7020', letterSpacing: '0.15em', textShadow: ORANGE_GLOW }}>
              PARTITION No.
            </span>
            <span className="font-display font-bold leading-none" style={{ fontSize: '28px', color: '#ff7020', textShadow: ORANGE_GLOW }}>
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-white/10" />

          {/* Name + pips */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor truncate">
                {player.playerName || player.playerId.slice(0, 8).toUpperCase()}
              </span>
              {isYou && <span className="font-jp text-[10px] text-[rgba(0,255,180,0.35)] shrink-0">あなた</span>}
            </div>
            <span className="font-display text-xs tracking-widest text-magi">{pips}</span>
          </div>

          {/* Ready status */}
          <span className={cn('font-display font-bold text-sm tracking-[0.05em] shrink-0', player.ready ? 'text-magi' : 'text-phosphor/25')}>
            {player.ready ? '■ READY' : '◌ WAITING'}
          </span>
        </div>
      </div>

      {/* Accent bar */}
      <div className="h-1.5 w-[96%]" style={{ background: accent }} />
    </div>
  );
}
