import { useEffect, useRef } from 'react';
import { renderQueue, QUEUE_WIDTH, QUEUE_HEIGHT } from '../render/queue';

interface Props {
  nextPieces: string[];
}

export function QueueCanvas({ nextPieces }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) renderQueue(ctx, nextPieces);
  }, [nextPieces]);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-zinc-600 text-xs tracking-widest uppercase font-mono">Next</p>
      <canvas
        ref={canvasRef}
        width={QUEUE_WIDTH}
        height={QUEUE_HEIGHT}
        className="block"
      />
    </div>
  );
}
