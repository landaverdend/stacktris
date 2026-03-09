import { useEffect, useRef } from 'react';
import { renderHold, HOLD_WIDTH, HOLD_HEIGHT } from '../render/queue';

interface Props {
  holdPiece: string | null;
  dimmed: boolean;
}

export function HoldCanvas({ holdPiece, dimmed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) renderHold(ctx, holdPiece, dimmed);
  }, [holdPiece, dimmed]);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-nerv-dim text-[9px] tracking-[0.3em] font-mono">HOLD <span className="opacity-50">// 保留</span></p>
      <canvas
        ref={canvasRef}
        width={HOLD_WIDTH}
        height={HOLD_HEIGHT}
        className="block"
      />
    </div>
  );
}
