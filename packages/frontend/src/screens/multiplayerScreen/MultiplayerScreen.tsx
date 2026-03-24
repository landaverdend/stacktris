import { useRef, useState, useEffect } from 'react';
import { useRoom } from '../../context/SessionContext';
import { COUNTDOWN_SECONDS, PlayerInfo } from '@stacktris/shared';
import { useConnection } from '../../ws/WSContext';
import { useMultiplayerGameSession } from '../../hooks/useMultiplayerGameSession';
import { HOLD_HEIGHT, HOLD_WIDTH, QUEUE_HEIGHT, QUEUE_WIDTH } from '../../render/queue';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../render/board';
import { GarbageMeter } from '../../components/GarbageMeter';
import { RoomStagingOverlay } from './RoomStagingOverlay';
import { PlayerList } from './PlayerList';
import { ConnectedBoards } from './ConnectedBoards';
import { ScrollFlareOverlay } from '../../components/ScrollFlareOverlay';

export function MultiplayerScreen() {
  // Refs for rendering the game state.
  const boardRef = useRef<HTMLCanvasElement>(null);
  const queueRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<HTMLCanvasElement>(null);

  const { roomState, leaveRoom } = useRoom();

  const { status } = roomState;

  // Leave room  if you navigate away from the page
  useEffect(
    () => {

      return () => {
        leaveRoom();
      }
    },
    [],
  );

  const { pendingGarbage, getTickCount, opponentBoards, winnerId, deadPlayers, isClientAlive } = useMultiplayerGameSession({
    board: boardRef,
    queue: queueRef,
    hold: holdRef,
  });
  const { playerId } = useConnection();

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] min-h-screen pt-14 gap-10 w-full">
      <div className="flex justify-end items-start pt-1">
        <PlayerList />
      </div>

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
              <canvas ref={boardRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block nerv-border bg-pit" />
              {status === 'waiting' && <RoomStagingOverlay />}
              {status === 'countdown' && <CountdownOverlay />}
              {status === 'intermission' && (
                <IntermissionOverlay
                  roundWinnerId={winnerId ?? null}
                  players={roomState.players}
                />
              )}
              {status === 'finished' && (
                <SessionWinnerOverlay
                  winner={roomState.players.find(p => p.playerId === roomState.matchWinnerId) as PlayerInfo}
                />
              )}
              {!isClientAlive && status === 'playing' && <ScrollFlareOverlay />}

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
      <div className="flex justify-start items-start pt-1">
        <ConnectedBoards
          players={roomState.players.filter((p) => p.playerId !== playerId)}
          opponentBoards={opponentBoards}
          deadPlayers={deadPlayers}
        />
      </div>
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
      <p className="text-alert font-display font-bold leading-none" style={{ fontSize: '7rem' }}>
        {countdownDisplay}
      </p>
      <p className="text-nerv-dim text-[15px] font-jp tracking-widest">準備完了 — ROUND START</p>
    </div>
  );
}

function IntermissionOverlay({ roundWinnerId, players }: { roundWinnerId: string | null; players: PlayerInfo[] }) {
  const winner = players.find(p => p.playerId === roundWinnerId);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
      <p className="text-nerv-dim text-xs font-mono tracking-[0.4em] uppercase">// SEQUENCE INTERMISSION</p>
      {winner && (
        <>
          <p className="text-phosphor font-display font-bold leading-none" style={{ fontSize: '3.5rem' }}>
            {winner.playerName}
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


function SessionWinnerOverlay({ winner }: { winner: PlayerInfo }) {

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
      <p className="text-nerv-dim text-xs font-mono tracking-[0.4em] uppercase">// SESSION OVER</p>
      {winner && (
        <>
          <p className="text-phosphor font-display font-bold leading-none" style={{ fontSize: '3.5rem' }}>
            {winner.playerName}
          </p>
          <p className="text-bitcoin font-display font-bold text-2xl tracking-widest uppercase">SESSION OVER</p>
        </>
      )}
      <p className="text-nerv-dim text-sm font-jp tracking-widest mt-1">シーケンス間</p>
    </div>
  )
}