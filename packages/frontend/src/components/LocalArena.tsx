import { useEffect, useRef, useState } from 'react';
import { PendingGarbage, PlayerInfo, WINS_TO_MATCH } from '@stacktris/shared';
import { LocalGame } from '../game/LocalGame';
import { DangerSignal, applyDangerBorder } from '../game/DangerSignal';
import { StaticVignetteOverlay } from './StaticVignetteOverlay';
import { ScrollFlareOverlay } from './ScrollFlareOverlay';
import { GarbageMeter } from './GarbageMeter';
import { IntermissionOverlay } from './IntermissionOverlay';
import { BoardCountdown } from './BoardCountdown';
import { CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE } from '../render/board';
import { QUEUE_WIDTH, QUEUE_HEIGHT, HOLD_WIDTH, HOLD_HEIGHT } from '../render/queue';
import { ClearEvent, ComboComponent } from './ComboComponent';

// Natural pixel dimensions of one arena (hold + gap + garbage + gap + board + gap + queue)
export const ARENA_WIDTH = HOLD_WIDTH + 8 + CELL_SIZE + 4 + CANVAS_WIDTH + 8 + QUEUE_WIDTH;
export const ARENA_HEIGHT = CANVAS_HEIGHT;

interface Props {
  game: LocalGame;
  playerLabel: string;
  scale?: number;
  wins?: number;
  winsTarget?: number;
  showIntermission?: boolean;
  isRoundWinner?: boolean;
  roundWinnerId?: string | null;
  intermissionPlayers?: PlayerInfo[];
  showCountdown?: boolean;
  countdown?: number;
  paused?: boolean;
}

export function LocalArena({ game, playerLabel, scale = 1, wins, winsTarget = WINS_TO_MATCH, showIntermission = false, isRoundWinner = false, roundWinnerId = null, intermissionPlayers = [], showCountdown = false, countdown = 0, paused = false }: Props) {
  const boardRef = useRef<HTMLCanvasElement>(null);
  const queueRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<HTMLCanvasElement>(null);
  const boardWrapperRef = useRef<HTMLDivElement>(null);
  const garbageRef = useRef<PendingGarbage[]>([]);

  const [isGameOver, setIsGameOver] = useState(false);
  const [dangerSignal, setDangerSignal] = useState<DangerSignal | null>(null);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(0);
  const [showB2b, setShowB2b] = useState(false);
  const [clearEvent, setClearEvent] = useState<ClearEvent | null>(null);
  const clearKeyRef = useRef(0);

  useEffect(() => {
    if (paused) game.pause(); else game.resume();
  }, [game, paused]);

  useEffect(() => {
    game.start({ board: boardRef.current!, queue: queueRef.current!, hold: holdRef.current! }, boardWrapperRef.current!);

    game.subscribe('pieceLocked', ({ b2b, linesCleared, isTSpin }) => {
      setLines(game.state.lines);
      setLevel(game.state.level);
      if (b2b) setShowB2b(true);
      else if (linesCleared > 0) setShowB2b(false);
      if (linesCleared === 4 || (isTSpin && linesCleared > 0)) {
        setClearEvent({ key: ++clearKeyRef.current, isTSpin, lines: linesCleared });
      }
    });

    game.subscribe('pendingGarbage', (queue) => { garbageRef.current = queue; });

    game.subscribe('gameOver', () => setIsGameOver(true));

    setDangerSignal(game.danger);
    const unsubDanger = game.danger.subscribe((level) => {
      applyDangerBorder(boardRef.current, level);
    });

    return () => {
      game.stop();
      unsubDanger();
    };
  }, [game]);

  const scaledW = ARENA_WIDTH * scale;
  const scaledH = (ARENA_HEIGHT + 40) * scale; // +40 for label + pips row

  return (
    // Outer box reserves exactly the scaled space so siblings lay out correctly
    <div style={{ width: scaledW, height: scaledH, flexShrink: 0, position: 'relative' }}>
      <div style={{ transform: `scale(${scale}) translateZ(0)`, transformOrigin: 'top left', width: ARENA_WIDTH, willChange: 'transform' }}>
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            {wins !== undefined && (
              <div className="flex gap-1">
                {Array.from({ length: winsTarget }, (_, i) => (
                  <span key={i} className={`text-sm ${i < wins ? 'text-teal' : 'text-phosphor/20'}`}>●</span>
                ))}
              </div>
            )}
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">{playerLabel}</span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="relative flex flex-col items-center gap-1.5">
              <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">HOLD</span>
                <span className="font-jp text-[12px] text-nerv-dim">ホールド</span>
              </div>
              <canvas ref={holdRef} width={HOLD_WIDTH} height={HOLD_HEIGHT} className="block nerv-border" />
              <ComboComponent showB2b={showB2b} clearEvent={clearEvent} />
            </div>

            <div className="flex items-end gap-1">
              <GarbageMeter garbageStackRef={garbageRef} getCurrentTick={() => game.frameCount} />
              <div ref={boardWrapperRef} className="relative">
                {isGameOver && !showIntermission && <ScrollFlareOverlay />}
                <canvas ref={boardRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block nerv-border bg-pit" />
                <StaticVignetteOverlay dangerSignal={dangerSignal} />
                {showCountdown && <BoardCountdown countdown={countdown} />}
                {showIntermission && (
                  <>
                    {isRoundWinner && <ScrollFlareOverlay word="CLEARED" color="#00ff88" fontSize={45} />}
                    <IntermissionOverlay roundWinnerId={roundWinnerId} players={intermissionPlayers} />
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">NEXT</span>
                <span className="font-jp text-[15px] text-nerv-dim">次</span>
              </div>
              <canvas ref={queueRef} width={QUEUE_WIDTH} height={QUEUE_HEIGHT} className="block nerv-border" />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
