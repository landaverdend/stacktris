import { useNavigate } from "react-router-dom";
import { useConnection } from "../../ws/WSContext";
import { useEffect, useState } from "react";
import { PlayerInfo, WINS_TO_MATCH } from "@stacktris/shared";
import { useRoom } from "../../context/RoomContext";
import { cn } from "../../lib/utils";
import { PaymentPanel } from "./PaymentPanel";

export function MultiplayerLobby() {
  const { roomState, leaveRoom, readyUpdate } = useRoom();
  const { playerId } = useConnection();

  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (roomState.status === 'waiting') setIsReady(false);
  }, [roomState.status]);

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };
  const handleReady = () => {
    const next = !isReady;
    setIsReady(next);
    readyUpdate(next);
  };

  return (
    <div className="flex flex-col w-full max-w-sm pt-2 nerv-border nerv-border-teal bg-black">
      {/* Header */}
      <div className="flex flex-col items-center justify-between px-5 pt-5 pb-3 border-b border-[rgba(0,255,180,0.08)]">
        <div className="flex flex-col gap-0.5">
          <span className="font-display font-bold text-4xl tracking-[0.02em] text-phosphor">OP_STAGING</span>
          <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">作戦準備中</span>
        </div>

        {roomState.buyIn > 0 && (
          <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor mt-1">
            BUY IN: <span className="text-bitcoin">{roomState.buyIn} sats</span>
          </span>
        )}
      </div>

      {/* Room ID */}
      <RoomIdBadge roomId={roomState.roomId} />

      {/* Payment */}
      {!roomState.invoicePaid && roomState.buyIn > 0 && (
        roomState.bolt11
          ? <PaymentPanel bolt11={roomState.bolt11} />
          : <PaymentPanelSkeleton />
      )}

      {/* Players */}
      <div className="flex flex-col">
        {roomState.players.map((p) => (
          <PlayerRow key={p.playerId} player={p} isYou={p.playerId === playerId} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 px-5 py-4 border-t border-[rgba(0,255,180,0.08)]">
        <button
          onClick={handleReady}
          className={cn(
            'w-full py-3 font-display font-bold text-4xl tracking-[0.02em] border transition-colors cursor-pointer',
            isReady
              ? 'border-[rgba(0,170,85,0.5)] text-magi hover:border-magi'
              : 'border-[rgba(0,255,180,0.4)] text-phosphor hover:border-[rgba(0,255,180,0.8)] hover:text-teal',
          )}>
          {isReady ? '■ CANCEL' : '◌ READY'}
        </button>
        <button
          onClick={handleLeave}
          className="w-full py-2 font-display font-bold text-2xl tracking-[0.02em] border border-[rgba(200,168,130,0.15)] text-phosphor/30 hover:border-alert hover:text-alert transition-colors cursor-pointer">
          ABORT
        </button>
      </div>
    </div>
  );
}

function PlayerRow({ player, isYou }: { player: PlayerInfo; isYou: boolean }) {
  const pips = Array.from({ length: WINS_TO_MATCH }, (_, i) => i < player.wins ? '■' : '□').join('');
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-b border-[rgba(0,255,180,0.08)]">
      <div className="flex items-baseline gap-2">
        <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor">
          {player.playerName || player.playerId.slice(0, 8).toUpperCase()}
        </span>
        {isYou && <span className="font-jp text-[12px] text-[rgba(0,255,180,0.3)]">あなた</span>}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-display text-sm tracking-widest text-magi">{pips}</span>
        <span className={cn('font-display font-bold text-xl tracking-[0.02em]', player.ready ? 'text-magi' : 'text-phosphor/30')}>
          {player.ready ? '■ READY' : '◌ WAITING'}
        </span>
      </div>
    </div>
  );
}

function PaymentPanelSkeleton() {
  return (
    <div className="border-b border-[rgba(0,255,180,0.08)] px-5 py-4 flex flex-col items-center gap-3">
      <div className="flex items-baseline gap-2 self-start">
        <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor">PAY INVOICE</span>
        <span className="font-jp text-[12px] text-[rgba(0,255,180,0.3)]">支払い</span>
      </div>
      {/* QR placeholder */}
      <div className="w-[196px] h-[196px] bg-[rgba(0,255,180,0.04)] animate-pulse" />
      {/* Button placeholders */}
      <div className="w-full h-9 bg-[rgba(0,255,180,0.04)] animate-pulse" />
      <div className="w-full h-9 bg-[rgba(247,147,26,0.06)] animate-pulse" />
    </div>
  );
}

function RoomIdBadge({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-b border-[rgba(0,255,180,0.08)]">
      <div className="flex items-baseline gap-2">
        <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor">SESSION ID</span>
        <span className="font-jp text-[12px] text-[rgba(0,255,180,0.3)]">セッションID</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-teal tracking-wide">{roomId.slice(0, 8).toUpperCase()}</span>
        <button
          onClick={copy}
          className="font-display font-bold text-xl tracking-[0.02em] text-phosphor/40 hover:text-teal transition-colors cursor-pointer border-l border-[rgba(0,255,180,0.1)] pl-3">
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
    </div>
  );
}
