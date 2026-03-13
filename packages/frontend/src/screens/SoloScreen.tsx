import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../render/board';
import { QUEUE_WIDTH, QUEUE_HEIGHT, HOLD_WIDTH, HOLD_HEIGHT } from '../render/queue';
import { GameStats, SoloGame } from '../game/SoloGame';

export function SoloScreen() {
  const navigate = useNavigate();

  const boardRef = useRef<HTMLCanvasElement>(null);
  const queueRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<HTMLCanvasElement>(null);

  const [stats, setStats] = useState<GameStats>({ score: 0, lines: 0, level: 0 });

  useEffect(() => {
    const game = new SoloGame();
    game.start({ board: boardRef.current!, queue: queueRef.current!, hold: holdRef.current! });

    return () => game.stop();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">

      <div className="flex items-center gap-6">
        <button onClick={() => navigate('/')} className="text-nerv-dim text-xs tracking-widest font-display hover:text-bitcoin transition-colors">
          ← EXIT
        </button>
        <span className="font-display text-bitcoin tracking-[0.3em] text-sm">SOLO MODE</span>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex flex-col gap-1 pt-1">
          <p className="text-nerv-dim text-[9px] tracking-[0.3em] font-mono">HOLD <span className="opacity-50">// ホールド</span></p>
          <canvas ref={holdRef} width={HOLD_WIDTH} height={HOLD_HEIGHT} className="block" />
        </div>
        <canvas ref={boardRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border border-border-hi bg-pit block" />
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1">
            <p className="text-nerv-dim text-[9px] tracking-[0.3em] font-mono">NEXT <span className="opacity-50">// 次</span></p>
            <canvas ref={queueRef} width={QUEUE_WIDTH} height={QUEUE_HEIGHT} className="block" />
          </div>
          <div className="flex flex-col gap-3 font-mono text-nerv-dim">
            <Stat label="SCORE" jp="スコア" value={stats.score.toLocaleString()} />
            <Stat label="LINES" jp="ライン" value={String(stats.lines)} />
            <Stat label="LEVEL" jp="レベル" value={String(stats.level)} />
          </div>
        </div>
      </div>

    </div>
  );
}

function Stat({ label, jp, value }: { label: string; jp: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] tracking-[0.3em]">{label} <span className="opacity-50">// {jp}</span></span>
      <span className="text-bitcoin text-sm font-bold">{value}</span>
    </div>
  );
}
