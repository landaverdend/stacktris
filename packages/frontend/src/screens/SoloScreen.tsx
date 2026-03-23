import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../render/board';
import { QUEUE_WIDTH, QUEUE_HEIGHT, HOLD_WIDTH, HOLD_HEIGHT } from '../render/queue';
import { LocalGame } from '../game/LocalGame';
import { ScrollFlareOverlay } from '../components/ScrollFlareOverlay';


export function SoloScreen() {
  const navigate = useNavigate();

  const boardRef = useRef<HTMLCanvasElement>(null);
  const queueRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<HTMLCanvasElement>(null);


  const [isGameOver, setIsGameOver] = useState(false);
  const [score] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const game = new LocalGame();
    game.start({ board: boardRef.current!, queue: queueRef.current!, hold: holdRef.current! });

    game.subscribe('pieceLocked', () => {
      setLines(game.state.lines);
      setLevel(game.state.level);
    });

    game.subscribe('gameOver', () => {
      setIsGameOver(true);
    })

    return () => game.stop();
  }, []);

  return (
    <div className="flex items-start justify-center min-h-screen pt-14 gap-10">
      {/* Arena */}
      <div className="flex items-start gap-3">
        {/* Hold */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">HOLD</span>
            <span className="font-jp text-[15px] text-nerv-dim">ホールド</span>
          </div>
          <canvas ref={holdRef} width={HOLD_WIDTH} height={HOLD_HEIGHT} className="block nerv-border" />
        </div>

        {/* Board */}
        <div className="relative flex flex-col gap-1.5">
          {isGameOver && <ScrollFlareOverlay />}
          {/* <ScrollFlareOverlay /> */}
          <canvas
            ref={boardRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block nerv-border bg-pit"
          />
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

      {/* Stats panel */}
      <div className="flex flex-col w-full max-w-sm pt-2 nerv-border nerv-border-teal bg-black">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[rgba(0,255,180,0.08)]">
          <div className="flex flex-col gap-0.5">
            <span className="font-display font-bold text-4xl tracking-[0.02em] text-phosphor">SOLO</span>
            <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">ソロプレイ</span>
          </div>
        </div>

        <div className="flex flex-col">
          <StatRow label="SCORE" jp="スコア" value={score.toLocaleString()} />
          <StatRow label="LINES" jp="ライン" value={String(lines)} />
          <StatRow label="LEVEL" jp="レベル" value={String(level)} />
        </div>

        <div className="px-5 py-4 border-t border-[rgba(0,255,180,0.08)]">
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 font-display font-bold text-2xl tracking-[0.02em] border border-[rgba(200,168,130,0.15)] text-phosphor/30 hover:border-alert hover:text-alert transition-colors cursor-pointer">
            ABORT
          </button>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, jp, value }: { label: string; jp: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(0,255,180,0.08)]">
      <div className="flex items-baseline gap-2">
        <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor">{label}</span>
        <span className="font-jp text-[12px] text-[rgba(0,255,180,0.3)]">{jp}</span>
      </div>
      <span className="font-display font-bold text-2xl tracking-[0.02em] text-magi">{value}</span>
    </div>
  );
}
