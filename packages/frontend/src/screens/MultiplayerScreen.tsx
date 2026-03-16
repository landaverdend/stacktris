import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { PlayerInfo, COUNTDOWN_SECONDS } from '@stacktris/shared';
import { cn } from '../lib/utils';
import { useConnection } from '../ws/WSContext';
import { useMultiplayerGameSession } from '../hooks/useMultiplayerGameSession';
import { HOLD_HEIGHT, HOLD_WIDTH, QUEUE_HEIGHT, QUEUE_WIDTH } from '../render/queue';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../render/board';
import { GarbageMeter } from '../components/GarbageMeter';

export function MultiplayerScreen() {
  // Refs for rendering the game state.
  const boardRef = useRef<HTMLCanvasElement>(null);
  const queueRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<HTMLCanvasElement>(null);

  const { roomState } = useRoom();

  const { status } = roomState;

  const { pendingGarbage } = useMultiplayerGameSession({ board: boardRef, queue: queueRef, hold: holdRef });

  return (
    <div className="flex items-start justify-center min-h-screen pt-14 gap-10">
      {/* ── Arena — always mounted, same position ── */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 pt-1">
          <p className="text-nerv-dim text-[9px] tracking-[0.3em] font-mono">
            HOLD <span className="opacity-50">// ホールド</span>
          </p>
          <canvas ref={holdRef} width={HOLD_WIDTH} height={HOLD_HEIGHT} className="block" />
        </div>

        <div className="flex items-end gap-1">
          <GarbageMeter garbageStack={pendingGarbage} />
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <canvas
                ref={boardRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="border border-border-hi bg-pit block"
              />
              {status === 'countdown' && <CountdownOverlay />}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1">
            <p className="text-nerv-dim text-[9px] tracking-[0.3em] font-mono">
              NEXT <span className="opacity-50">// 次</span>
            </p>
            <canvas ref={queueRef} width={QUEUE_WIDTH} height={QUEUE_HEIGHT} className="block" />
          </div>
        </div>
      </div>

      {/* ── Right panel — MissionStaging or opponent mini board ── */}
      {(status === 'waiting' || status === 'countdown') && <PlayerLobby />}
    </div>
  );
}

interface PlayerLobbyProps { }
function PlayerLobby({ }: PlayerLobbyProps) {
  const { roomState, leaveRoom, readyUpdate } = useRoom();
  const { playerId } = useConnection();

  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);

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
    <div className="flex flex-col items-center gap-8 w-full max-w-sm pt-2">
      <div className="text-center flex flex-col gap-2">
        <p className="text-nerv-dim text-xs tracking-[0.4em] font-mono">ネルフ</p>
        <p className="text-bitcoin font-display font-bold text-3xl tracking-[0.3em]">OP_STAGING</p>
        <p className="text-nerv-dim text-xs tracking-[0.3em] font-jp mt-1">作戦準備中</p>
      </div>

      <RoomIdBadge roomId={roomState.roomId} />

      <div className="w-full flex flex-col gap-3">
        {roomState.players.map((p) => (
          <PlayerRow key={p.playerId} player={p} isYou={p.playerId === playerId} />
        ))}
      </div>

      <button
        onClick={handleReady}
        className={cn(
          'w-full py-4 font-display font-bold text-base tracking-[0.3em] nerv-frame border transition-colors cursor-pointer',
          isReady
            ? 'border-magi text-magi hover:bg-magi hover:text-black'
            : 'border-bitcoin text-bitcoin hover:bg-bitcoin hover:text-black',
        )}>
        {isReady ? '■ READY — CLICK TO CANCEL' : '◌ CONFIRM READY'}
      </button>

      <button
        onClick={handleLeave}
        className="px-6 py-2.5 border border-border-hi text-nerv-dim font-display text-xs tracking-[0.2em] hover:border-alert hover:text-alert transition-colors cursor-pointer">
        ABORT
      </button>
    </div>
  );
}

function PlayerRow({ player }: { player: PlayerInfo; isYou: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-nerv-dim text-[10px] font-mono tracking-[0.3em]">{player.playerId}</span>
      <span className={cn('text-[10px] font-mono tracking-[0.3em]', player.ready ? 'text-magi' : 'text-nerv-dim')}>
        {player.ready ? 'READY' : 'NOT READY'}
      </span>
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
    <div className="flex flex-col items-center gap-2">
      <span className="text-nerv-dim text-[10px] font-mono tracking-[0.3em]">SESSION ID</span>
      <div className="flex items-center gap-3 border border-border-hi bg-surface px-4 py-2.5 nerv-frame">
        <span className="text-bitcoin font-mono text-xs tracking-wider">{roomId}</span>
        <button
          onClick={copy}
          className="text-nerv-dim hover:text-bitcoin transition-colors text-[10px] font-display tracking-widest border-l border-border pl-3"
          title="Copy room ID">
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <span className="text-nerv-dim/50 text-[9px] font-jp">共有コード — SHARE WITH OPPONENT</span>
    </div>
  );
}

function CountdownOverlay() {
  const [countdownDisplay, setCountdownDisplay] = useState<number | 'GO!'>(COUNTDOWN_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownDisplay((prev) => (typeof prev === 'number' && prev > 1 ? prev - 1 : 'GO!'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
      <p className="text-nerv-dim text-[9px] font-mono tracking-[0.4em]">// COMBAT SEQUENCE INITIATING</p>
      <p className="text-bitcoin font-display font-bold leading-none" style={{ fontSize: '7rem' }}>
        {countdownDisplay}
      </p>
      <p className="text-nerv-dim text-[8px] font-jp tracking-widest">準備完了 — MAGI SYNC COMPLETE</p>
    </div>
  );
}
