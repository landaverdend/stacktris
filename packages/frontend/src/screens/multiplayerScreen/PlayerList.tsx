import { PlayerInfo, WINS_TO_MATCH } from "../../../../shared/dist/protocol";
import { useRoom } from "../../context/SessionContext";
import { cn, truncateName } from "../../lib/utils";
import { useConnection } from "../../ws/WSContext";
import { useTranslation } from "react-i18next";
import { ControlsButton } from "../../components/ControlsModal";
import { useNavigate } from "react-router-dom";



export function PlayerList() {
  const { roomState, leaveRoom } = useRoom();
  const { playerId } = useConnection();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="font-display font-bold text-4xl tracking-[0.02em] text-alert border-2! rounded-none! nerv-border nerv-border-alert px-2">{t('players.title')}</span>

      {roomState.players.map((p, i) => (
        <PlayerRow key={p.playerId} player={p} isYou={p.playerId === playerId} index={i} />
      ))}

      <ControlsButton className="w-full mt-1 py-2 font-display font-bold text-xl tracking-[0.05em] border border-[rgba(0,255,180,0.15)] text-phosphor/30 hover:border-teal hover:text-teal transition-colors cursor-pointer" />
      <button
        onClick={handleLeave}
        className="w-full py-2 font-display font-bold text-xl tracking-[0.05em] border border-[rgba(200,168,130,0.4)] text-alert/70 hover:border-alert hover:text-alert transition-colors cursor-pointer">
        {t('multiplayer_nav.leave_room')}
      </button>
    </div>
  )
}

const ORANGE_GLOW = '0 0 4px rgba(255,112,32,0.6)';

function PlayerRow({ player, isYou, index }: { player: PlayerInfo; isYou: boolean; index: number }) {
  const { roomState } = useRoom();
  const { t } = useTranslation();

  const pips = Array.from({ length: WINS_TO_MATCH }, (_, i) => i < player.wins ? '■' : '□').join('');
  const alpha = isYou ? 0.55 : 0.28;
  const background = `linear-gradient(90deg, rgba(230,140,20,${alpha}), rgba(180,40,60,${alpha}), rgba(110,20,90,${alpha}))`;
  const accentAlpha = isYou ? 0.4 : 0.18;
  const accent = `linear-gradient(90deg, rgba(230,140,20,${accentAlpha}), rgba(180,40,60,${accentAlpha}), rgba(110,20,90,${accentAlpha}))`;

  const truncatedName = player.playerName ? truncateName(player.playerName, 9) : null;

  return (
    <div className="flex flex-col gap-1 min-w-80">
      {/* Main bar */}
      <div className="relative h-16">
        <div className="absolute inset-0" style={{ background, clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)' }} />
        <div className="relative flex items-center h-full px-5 gap-4">
          {/* Index number */}
          <div className="flex flex-col items-start -mr-1">
            <span className="font-display font-bold leading-none" style={{ fontSize: '10px', color: '#ff7020', letterSpacing: '0.15em', textShadow: ORANGE_GLOW }}>
              {t('players.player_no')}
            </span>
            <span className="font-display font-bold leading-none" style={{ fontSize: '34px', color: '#ff7020', textShadow: ORANGE_GLOW }}>
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>

          {/* Divider */}
          <div className="h-10 w-px bg-white/10" />

          {/* Name + pips */}
          <div className="flex flex-col flex-1 min-w-0 bg-black border-nerv-dim border px-2 rounded-md">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl tracking-[0.02em] text-truncate text-aqua">
                {truncatedName || player.playerId.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <span className="font-display text-sm tracking-widest text-alert">{pips}</span>
          </div>

          {/* Ready status */}
          {roomState.status === 'waiting' && <span className={cn('font-display font-bold text-base tracking-[0.05em] shrink-0', player.ready ? 'text-magi' : 'text-phosphor/25')}>
            {player.ready ? t('players.ready') : t('players.waiting')}
          </span>}
        </div>
      </div>

      {/* Accent bar */}
      <div className="h-2 w-[96%]" style={{ background: accent }} />
    </div>
  );
}
