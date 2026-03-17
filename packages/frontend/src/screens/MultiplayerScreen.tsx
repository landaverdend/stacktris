import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { PlayerInfo, COUNTDOWN_SECONDS } from '@stacktris/shared';
import { cn } from '../lib/utils';
import { useConnection } from '../ws/WSContext';
import { useMultiplayerGameSession } from '../hooks/useMultiplayerGameSession';
import { HOLD_HEIGHT, HOLD_WIDTH, QUEUE_HEIGHT, QUEUE_WIDTH } from '../render/queue';
import { CANVAS_HEIGHT, CANVAS_WIDTH, OPPONENT_CELL_SIZE } from '../render/board';
import { GarbageMeter } from '../components/GarbageMeter';
import { OpponentBoard } from '../components/OpponentBoard';

export function MultiplayerScreen() {
  // Refs for rendering the game state.
  const boardRef = useRef<HTMLCanvasElement>(null);
  const queueRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<HTMLCanvasElement>(null);

  const { roomState } = useRoom();

  const { status } = roomState;

  const { pendingGarbage, getTickCount, opponentBoards, winnerId } = useMultiplayerGameSession({ board: boardRef, queue: queueRef, hold: holdRef });
  const { playerId } = useConnection();

  return (
    <div className="flex items-start justify-center min-h-screen pt-14 gap-10">
      {/* ── Arena — always mounted, same position ── */}
      <div className="flex items-start gap-3">
        {/* Hold */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">HOLD</span>
            <span className="font-jp text-[15px] text-nerv-dim">ホールド</span>
          </div>
          <canvas ref={holdRef} width={HOLD_WIDTH} height={HOLD_HEIGHT} className="block nerv-border" />
        </div>

        <div className="flex items-end gap-1">
          <GarbageMeter garbageStack={pendingGarbage} getCurrentTick={getTickCount} />
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <canvas
                ref={boardRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="block nerv-border bg-pit"
              />
              {status === 'countdown' && <CountdownOverlay />}
              {winnerId !== undefined && <GameOverOverlay winnerId={winnerId} playerId={playerId} />}
            </div>
          </div>
        </div>

        {/* Next */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">NEXT</span>
            <span className="font-jp text-[15px] text-nerv-dim">次</span>
          </div>
          <canvas ref={queueRef} width={QUEUE_WIDTH} height={QUEUE_HEIGHT} className="block nerv-border" />
        </div>
      </div>

      {/* ── Right panel — lobby or opponent boards ── */}
      {status === 'playing'
        ? <div className="flex flex-wrap gap-4" style={{ maxWidth: 2 * 10 * OPPONENT_CELL_SIZE + 16 }}>
          {Object.entries(opponentBoards).map(([id, board]) => (
            <OpponentBoard key={id} board={board} />
          ))}
        </div>
        : <PlayerLobby />}
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
    <div className="flex flex-col w-full max-w-sm pt-2 nerv-border nerv-border-teal bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[rgba(0,255,180,0.08)]">
        <div className="flex flex-col gap-0.5">
          <span className="font-display font-bold text-4xl tracking-[0.02em] text-phosphor">OP_STAGING</span>
          <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">作戦準備中</span>
        </div>
      </div>

      {/* Room ID */}
      <RoomIdBadge roomId={roomState.roomId} />

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
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-b border-[rgba(0,255,180,0.08)]">
      <div className="flex items-baseline gap-2">
        <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor">
          {player.playerId.slice(0, 8).toUpperCase()}
        </span>
        {isYou && <span className="font-jp text-[12px] text-[rgba(0,255,180,0.3)]">あなた</span>}
      </div>
      <span className={cn('font-display font-bold text-xl tracking-[0.02em]', player.ready ? 'text-magi' : 'text-phosphor/30')}>
        {player.ready ? '■ READY' : '◌ WAITING'}
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

function GameOverOverlay({ winnerId, playerId }: { winnerId: string | null; playerId: string | null }) {
  const isWinner = winnerId !== null && winnerId === playerId;
  const isDraw = winnerId === null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
      <p className="text-nerv-dim text-[9px] font-mono tracking-[0.4em]">// COMBAT SEQUENCE TERMINATED</p>
      <p className={cn('font-display font-bold leading-none text-5xl tracking-[0.2em]', isWinner ? 'text-magi' : 'text-alert')}>
        {isDraw ? 'DRAW' : isWinner ? 'VICTORY' : 'DEFEAT'}
      </p>
      <p className="text-nerv-dim text-[8px] font-jp tracking-widest mt-1">
        {isDraw ? '引き分け' : isWinner ? '勝利' : '敗北'}
      </p>
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
      <p className="text-nerv-dim text-[8px] font-jp tracking-widest">準備完了 — SYNC COMPLETE</p>
    </div>
  );
}
