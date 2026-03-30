import { useEffect, useRef, useState } from 'react';
import { NervGridOverlay } from '../components/NervGridOverlay';
import { TelemetryColumns } from '../components/TelemetryColumns';
import { useNavigate } from 'react-router-dom';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../render/board';
import { QUEUE_WIDTH, QUEUE_HEIGHT, HOLD_WIDTH, HOLD_HEIGHT } from '../render/queue';
import { LocalGame } from '../game/LocalGame';
import { DangerSignal, applyDangerBorder } from '../game/DangerSignal';
import { StaticVignetteOverlay } from '../components/StaticVignetteOverlay';
import { ScrollFlareOverlay } from '../components/ScrollFlareOverlay';
import { ControlsButton } from '../components/ControlsModal';
import { useTranslation } from 'react-i18next';
import { ClearEvent, ComboComponent } from '../components/ComboComponent';

export function SoloScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const boardRef = useRef<HTMLCanvasElement>(null);
  const queueRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<HTMLCanvasElement>(null);
  const boardWrapperRef = useRef<HTMLDivElement>(null);

  const [isGameOver, setIsGameOver] = useState(false);
  const [dangerSignal, setDangerSignal] = useState<DangerSignal | null>(null);
  const [score] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(0);
  const [showB2b, setShowB2b] = useState(false);
  const [clearEvent, setClearEvent] = useState<ClearEvent | null>(null);
  const clearKeyRef = useRef(0);

  useEffect(() => {
    const game = new LocalGame();
    game.start(
      { board: boardRef.current!, queue: queueRef.current!, hold: holdRef.current! },
      boardWrapperRef.current!,
    );

    /**
     * This is kind of a mess, but the state that we're interested in is the gamestate after a piece lock.
     */
    game.subscribe('pieceLocked', ({ b2b, linesCleared, isTSpin }) => {
      setLines(game.state.lines);
      setLevel(game.state.level);
      if (b2b) setShowB2b(true);
      else if (!game.state.b2b) setShowB2b(false);
      if (linesCleared === 4 || (isTSpin && linesCleared > 0)) {
        setClearEvent({ key: ++clearKeyRef.current, isTSpin, lines: linesCleared });
      }
    });

    game.subscribe('gameOver', () => {
      setIsGameOver(true);
    });

    setDangerSignal(game.danger);

    const unsubDanger = game.danger.subscribe(level => {
      applyDangerBorder(boardRef.current, level);
    });

    return () => { game.stop(); unsubDanger(); };
  }, []);

  return (
    <>
      <NervGridOverlay dangerSignal={dangerSignal} />
      <TelemetryColumns dangerSignal={dangerSignal} />
      <div className="flex items-start justify-center min-h-screen pt-14 gap-10">
        {/* Arena */}
        <div className="flex items-start gap-3">
          {/* Hold */}
          <div className="relative flex flex-col gap-1.5 pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">{t('solo.hold')}</span>
              <span className="font-jp text-[15px] text-nerv-dim">ホールド</span>
            </div>
            <canvas ref={holdRef} width={HOLD_WIDTH} height={HOLD_HEIGHT} className="block nerv-border" />
            <ComboComponent showB2b={showB2b} clearEvent={clearEvent} />
          </div>

          {/* Board */}
          <div ref={boardWrapperRef} className="relative flex flex-col gap-1.5">
            {isGameOver && <ScrollFlareOverlay />}
            <canvas ref={boardRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block nerv-border bg-pit" />
            <StaticVignetteOverlay dangerSignal={dangerSignal} />
          </div>

          {/* Next */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">{t('solo.next')}</span>
              <span className="font-jp text-[15px] text-nerv-dim">次</span>
            </div>
            <canvas ref={queueRef} width={QUEUE_WIDTH} height={QUEUE_HEIGHT} className="block nerv-border" />
          </div>
        </div>

        {/* Stats panel */}
        <div className="flex flex-col w-full max-w-sm pt-2 nerv-border nerv-border-teal bg-black">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[rgba(0,255,180,0.08)]">
            <div className="flex flex-col gap-0.5">
              <span className="font-display font-bold text-4xl tracking-[0.02em] text-phosphor">{t('solo.title')}</span>
              <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">ソロプレイ</span>
            </div>
          </div>

          <div className="flex flex-col">
            <StatRow label={t('solo.lines')} jp="ライン" value={String(lines)} />
            <StatRow label={t('solo.level')} jp="レベル" value={String(level)} />
          </div>

          <div className="px-5 py-4 border-t border-[rgba(0,255,180,0.08)] flex gap-2">
            <ControlsButton className="flex-1 py-2 font-display font-bold text-2xl tracking-[0.02em] border border-[rgba(0,255,180,0.15)] text-phosphor/30 hover:border-teal hover:text-teal transition-colors cursor-pointer" />
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-2 font-display font-bold text-2xl tracking-[0.02em] border border-[rgba(200,168,130,0.15)] text-phosphor/30 hover:border-alert hover:text-alert transition-colors cursor-pointer">
              {t('solo.abort')}
            </button>
          </div>
        </div>
      </div>
    </>
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
