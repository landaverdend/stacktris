import { useRef, useState, useEffect } from 'react';
import { applyDangerBorder } from '../../game/DangerSignal';
import { StaticVignetteOverlay } from '../../components/StaticVignetteOverlay';
import { BoardCountdown } from '../../components/BoardCountdown';
import { useRoom } from '../../context/SessionContext';
import { COUNTDOWN_SECONDS } from '@stacktris/shared';
import { useTranslation } from 'react-i18next';
import { useConnection } from '../../ws/WSContext';
import { useMultiplayerGameSession } from '../../hooks/useMultiplayerGameSession';
import { HOLD_HEIGHT, HOLD_WIDTH, QUEUE_HEIGHT, QUEUE_WIDTH } from '../../render/queue';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../render/board';
import { GarbageMeter } from '../../components/GarbageMeter';
import { RoomCodeBar } from './RoomCodeBar';
import { PlayerList } from './PlayerList';
import { ConnectedBoards } from './ConnectedBoards';
import { BoardOverlay } from './BoardOverlay';
import { EvaSystemClock } from '../../components/EvaSystemClock';
import { NervGridOverlay } from '../../components/NervGridOverlay';
import { TelemetryColumns } from '../../components/TelemetryColumns';
import { ComboComponent } from '../../components/ComboComponent';

export function MultiplayerScreen() {
  // Refs for rendering the game state.
  const boardRef = useRef<HTMLCanvasElement>(null);
  const queueRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<HTMLCanvasElement>(null);
  const boardWrapperRef = useRef<HTMLDivElement>(null);

  const { roomState, leaveRoom } = useRoom();
  const { t } = useTranslation();

  const { status } = roomState;

  const [roundStartedAt, setRoundStartedAt] = useState<number | null>(null);
  useEffect(() => {
    if (status === 'playing') {
      setRoundStartedAt(prev => prev ?? Date.now());
    } else {
      setRoundStartedAt(null);
    }
  }, [status]);

  // Leave room  if you navigate away from the page
  useEffect(
    () => {
      return () => {
        leaveRoom();
      }
    },
    [],
  );

  const { pendingGarbageRef, getTickCount, opponentBoards, opponentActivePieces, winnerId, deadPlayers, isClientAlive, dangerSignal, showB2b, clearEvent } = useMultiplayerGameSession({
    board: boardRef,
    queue: queueRef,
    hold: holdRef,
    boardWrapper: boardWrapperRef,
  });

  useEffect(() => {
    if (!dangerSignal) return;
    applyDangerBorder(boardRef.current, dangerSignal.value);
    return dangerSignal.subscribe(level => {
      applyDangerBorder(boardRef.current, level);
    });
  }, [dangerSignal]);
  const { playerId } = useConnection();

  return (
    <>
      <NervGridOverlay dangerSignal={dangerSignal} />
      <TelemetryColumns dangerSignal={dangerSignal} />
      <EvaSystemClock roundStartedAt={roundStartedAt} dangerSignal={dangerSignal} />
      <div className="grid grid-cols-[1fr_auto_1fr] min-h-screen pt-14 gap-10 w-full">
        <div className="flex justify-end items-start pt-1">
          <PlayerList />
        </div>

        {/* ── Arena — always mounted, same position ── */}
        <div className="flex items-start gap-3">
          {/* Hold */}
          <div className="relative flex flex-col gap-1.5 pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">{t('multiplayer.hold')}</span>
              <span className="font-jp text-[15px] text-nerv-dim">ホールド</span>
            </div>
            <canvas ref={holdRef} width={HOLD_WIDTH} height={HOLD_HEIGHT} className="block nerv-border" />
            <ComboComponent showB2b={showB2b} clearEvent={clearEvent} />
          </div>

          <div className="flex items-end gap-1">
            <GarbageMeter garbageStackRef={pendingGarbageRef} getCurrentTick={getTickCount} />
            <div className="flex flex-col gap-1.5">
              <RoomCodeBar roomId={roomState.roomId} />


              <div ref={boardWrapperRef} className="relative">
                <canvas ref={boardRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block nerv-border bg-pit" />
                <StaticVignetteOverlay dangerSignal={dangerSignal} />
                {status === 'countdown' && <BoardCountdown countdown={COUNTDOWN_SECONDS} />}
                <BoardOverlay
                  status={status}
                  playerId={playerId ?? ''}
                  isClientAlive={isClientAlive}
                  roundWinnerId={winnerId ?? null}
                  matchWinnerId={roomState.matchWinnerId}
                  players={roomState.players}
                  potSats={roomState.potSats}
                  payoutPending={roomState.payoutPending}
                />

              </div>
            </div>
          </div>

          {/* Next */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">{t('multiplayer.next')}</span>
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
            activePieceMapRef={opponentActivePieces}
            deadPlayers={deadPlayers}
            roundWinnerId={winnerId}
          />
        </div>
      </div>
    </>
  );
}



