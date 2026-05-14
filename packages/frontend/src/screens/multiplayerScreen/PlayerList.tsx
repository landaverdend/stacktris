import { PlayerInfo } from "../../../../shared/dist/protocol";
import { useRoom } from "../../context/SessionContext";
import { PlayerCard } from "../../components/PlayerCard";
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

      {roomState.players.map((p: PlayerInfo, i: number) => (
        <PlayerCard
          key={p.playerId}
          index={i}
          playerName={p.playerName}
          playerId={p.playerId}
          wins={p.wins}
          ready={p.ready}
          showReadyStatus={roomState.status === 'waiting'}
        />
      ))}

      <ControlsButton className="w-full mt-1 py-2 font-display font-bold text-xl tracking-[0.05em] border border-[rgba(0,255,180,0.15)] text-phosphor/30 hover:border-teal hover:text-teal transition-colors cursor-pointer" />
      <button
        onClick={handleLeave}
        className="w-full py-2 font-display font-bold text-xl tracking-[0.05em] border border-[rgba(200,168,130,0.4)] text-alert/70 hover:border-alert hover:text-alert transition-colors cursor-pointer">
        {t('multiplayer_nav.leave_room')}
      </button>
    </div>
  );
}
