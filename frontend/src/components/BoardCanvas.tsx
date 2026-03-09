import { useEffect, useRef } from 'react';
import { PieceSnapshot } from '../types';
import { renderBoard, CANVAS_WIDTH, CANVAS_HEIGHT } from '../render/board';

interface Props {
  board: number[][];
  activePiece?: PieceSnapshot | null;
  dimmed?: boolean;
  label?: string;

  /** Scale the rendered canvas down via CSS (0–1). Pixel dimensions stay the same for sharpness. */
  scale?: number;
}

export function BoardCanvas({ board, activePiece = null, dimmed = false, label, scale = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!activePiece?.lock_active) {
      renderBoard(ctx, board, activePiece, dimmed);
      return;
    }

    // Pulse the active piece while lock delay is counting down.
    let rafId: ReturnType<typeof requestAnimationFrame>;
    const animate = () => {
      const alpha = 0.55 + 0.45 * Math.sin(Date.now() / 70);
      renderBoard(ctx, board, activePiece, dimmed, alpha);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [board, activePiece, dimmed]);

  return (
    <div className="flex flex-col items-center gap-1 font-mono" style={{ width: CANVAS_WIDTH * scale }}>
      {label && <p className="text-nerv-dim text-[9px] tracking-[0.3em] font-mono">{label}</p>}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          width: CANVAS_WIDTH * scale,
          height: CANVAS_HEIGHT * scale,
        }}
        className="border border-border-hi bg-pit block"
      />
    </div>
  );
}
