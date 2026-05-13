import { useEffect, useRef, useState } from 'react';
import { LocalGame } from '../game/LocalGame';
import { DangerSignal, applyDangerBorder } from '../game/DangerSignal';
import { StaticVignetteOverlay } from './StaticVignetteOverlay';
import { ScrollFlareOverlay } from './ScrollFlareOverlay';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../render/board';
import { QUEUE_WIDTH, QUEUE_HEIGHT, HOLD_WIDTH, HOLD_HEIGHT } from '../render/queue';

// Natural pixel dimensions of one arena (hold + gap + board + gap + queue)
export const ARENA_WIDTH = HOLD_WIDTH + 8 + CANVAS_WIDTH + 8 + QUEUE_WIDTH;
export const ARENA_HEIGHT = CANVAS_HEIGHT;

interface Props {
  playerLabel: string;
  scale?: number;
}

export function LocalArena({ playerLabel, scale = 1 }: Props) {
  const boardRef = useRef<HTMLCanvasElement>(null);
  const queueRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<HTMLCanvasElement>(null);
  const boardWrapperRef = useRef<HTMLDivElement>(null);

  const [isGameOver, setIsGameOver] = useState(false);
  const [dangerSignal, setDangerSignal] = useState<DangerSignal | null>(null);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const game = new LocalGame();
    game.start({ board: boardRef.current!, queue: queueRef.current!, hold: holdRef.current! }, boardWrapperRef.current!);

    game.subscribe('pieceLocked', () => {
      setLines(game.state.lines);
      setLevel(game.state.level);
    });

    game.subscribe('gameOver', () => setIsGameOver(true));

    setDangerSignal(game.danger);
    const unsubDanger = game.danger.subscribe((level) => {
      applyDangerBorder(boardRef.current, level);
    });

    return () => {
      game.stop();
      unsubDanger();
    };
  }, []);

  const scaledW = ARENA_WIDTH * scale;
  const scaledH = (ARENA_HEIGHT + 28) * scale; // +28 for label row

  return (
    // Outer box reserves exactly the scaled space so siblings lay out correctly
    <div style={{ width: scaledW, height: scaledH, flexShrink: 0 }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: ARENA_WIDTH }}>
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">{playerLabel}</span>
            <span className="font-mono text-[11px] text-[rgba(0,255,180,0.4)] tracking-widest">
              LV {level} — {lines}L
            </span>
          </div>

          <div className="flex items-start gap-2">
            <canvas ref={holdRef} width={HOLD_WIDTH} height={HOLD_HEIGHT} className="block nerv-border" />

            <div ref={boardWrapperRef} className="relative">
              {isGameOver && <ScrollFlareOverlay />}
              <canvas ref={boardRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block nerv-border bg-pit" />
              <StaticVignetteOverlay dangerSignal={dangerSignal} />
            </div>

            <canvas ref={queueRef} width={QUEUE_WIDTH} height={QUEUE_HEIGHT} className="block nerv-border" />
          </div>
        </div>
      </div>
    </div>
  );
}
