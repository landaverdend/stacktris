import { useRef, useState, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';
import { COUNTDOWN_SECONDS } from '@stacktris/shared';
import { cn } from '../../lib/utils';
import { useConnection } from '../../ws/WSContext';
import { useMultiplayerGameSession } from '../../hooks/useMultiplayerGameSession';
import { HOLD_HEIGHT, HOLD_WIDTH, QUEUE_HEIGHT, QUEUE_WIDTH } from '../../render/queue';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../render/board';
import { GarbageMeter } from '../../components/GarbageMeter';
import { RoomStagingOverlay } from './RoomStagingOverlay';
import { PlayerList } from './PlayerList';
import { ConnectedBoards } from './ConnectedBoards';

export function MultiplayerScreen() {
  // Refs for rendering the game state.
  const boardRef = useRef<HTMLCanvasElement>(null);
  const queueRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<HTMLCanvasElement>(null);

  const { roomState, leaveRoom } = useRoom();

  const { status } = roomState;

  // Leave room  if you navigate away from the page
  useEffect(() => () => { leaveRoom(); }, []);

  const { pendingGarbage, getTickCount, opponentBoards, winnerId } = useMultiplayerGameSession({ board: boardRef, queue: queueRef, hold: holdRef });
  const { playerId } = useConnection();

  console.log(opponentBoards);

  return (
    <div className="flex items-start justify-center min-h-screen pt-14 gap-10">

      <PlayerList />

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
              {status === 'waiting' && <RoomStagingOverlay />}
              {status === 'countdown' && <CountdownOverlay />}
              {winnerId !== undefined && status === 'finished' && (
                roomState.matchWinnerId !== null
                  ? <MatchOverOverlay matchWinnerId={roomState.matchWinnerId} playerId={playerId} />
                  : <RoundOverOverlay winnerId={winnerId} playerId={playerId} />
              )}
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

      {/* ── Right panel - opponent boards ── */}
      <ConnectedBoards
        players={roomState.players.filter(p => p.playerId !== playerId)}
        opponentBoards={opponentBoards}
      />

    </div>
  );
}

function RoundOverOverlay({ winnerId, playerId }: { winnerId: string | null; playerId: string | null }) {
  const isWinner = winnerId !== null && winnerId === playerId;
  const isDraw = winnerId === null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
      <p className="text-nerv-dim text-[9px] font-mono tracking-[0.4em]">// ROUND TERMINATED</p>
      <p className={cn('font-display font-bold leading-none text-5xl tracking-[0.2em]', isWinner ? 'text-magi' : isDraw ? 'text-phosphor' : 'text-alert')}>
        {isDraw ? 'DRAW' : isWinner ? 'ROUND WIN' : 'ROUND LOSS'}
      </p>
      <p className="text-nerv-dim text-[8px] font-jp tracking-widest mt-1">
        {isDraw ? '引き分け' : isWinner ? '勝利' : '敗北'}
      </p>
    </div>
  );
}

function MatchOverOverlay({ matchWinnerId, playerId }: { matchWinnerId: string | null; playerId: string | null }) {
  const isWinner = matchWinnerId !== null && matchWinnerId === playerId;
  const isDraw = matchWinnerId === null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
      <p className="text-nerv-dim text-[9px] font-mono tracking-[0.4em]">// SEQUENCE TERMINATED</p>
      <p className={cn('font-display font-bold leading-none text-5xl tracking-[0.2em]', isWinner ? 'text-magi' : isDraw ? 'text-phosphor' : 'text-alert')}>
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
      <p className="text-nerv-dim text-[9px] font-mono tracking-[0.4em]">// SEQUENCE INITIATING</p>
      <p className="text-bitcoin font-display font-bold leading-none" style={{ fontSize: '7rem' }}>
        {countdownDisplay}
      </p>
      <p className="text-nerv-dim text-[8px] font-jp tracking-widest">準備完了 — SYNC COMPLETE</p>
    </div>
  );
}
