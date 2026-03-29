import { useEffect, useRef } from 'react';
import { DangerSignal } from '../game/DangerSignal';

interface Props {
  dangerSignal: DangerSignal | null;
}

export function StaticVignetteOverlay({ dangerSignal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signalRef = useRef(dangerSignal);
  signalRef.current = dangerSignal;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Size the canvas buffer to match actual CSS dimensions so the center
    // is always correct regardless of border/padding on the parent.
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    let rafId: number;
    const loop = () => {
      const danger = signalRef.current?.value ?? 0;
      drawStaticVignette(ctx, canvas.width, canvas.height, danger);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

// ── Renderer ──────────────────────────────────────────────────────────────────
// Exported so other canvases (e.g. OpponentBoard) can call it directly
// from their own RAF loop without spinning up a second one.

export function drawStaticVignette(ctx: CanvasRenderingContext2D, W: number, H: number, danger: number) {
  const CX = W / 2;
  const CY = H / 2;

  ctx.clearRect(0, 0, W, H);

  if (danger < 0.04) return;

  // ── 1. Inset vignette gradient ─────────────────────────────────────────────
  const vigFlicker  = 1 - Math.random() * danger * 0.14;
  const vigAlpha    = Math.pow(danger, 0.85) * 0.38 * vigFlicker;
  const innerRadius = Math.hypot(CX, CY) * (0.25 + (1 - danger) * 0.25);
  const outerRadius = Math.hypot(CX, CY) * 1.05;

  const grad = ctx.createRadialGradient(CX, CY, innerRadius, CX, CY, outerRadius);
  grad.addColorStop(0,    'rgba(0,0,0,0)');
  grad.addColorStop(0.55, `rgba(110,0,0,${(vigAlpha * 0.35).toFixed(3)})`);
  grad.addColorStop(1,    `rgba(175,0,0,${vigAlpha.toFixed(3)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ── 2. Static noise pixels ─────────────────────────────────────────────────
  const densityJitter = 0.8 + Math.random() * 0.4;
  const count = Math.floor(danger * danger * 700 * densityJitter);

  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;

    const dx = (x - CX) / CX;
    const dy = (y - CY) / CY;
    const edge = Math.min(Math.hypot(dx, dy), 1.42) / 1.42;

    const baseAlpha = edge * edge * (0.25 + Math.random() * 0.55) * (0.4 + danger * 0.6);
    if (baseAlpha < 0.04) continue;

    if (danger > 0.55 && Math.random() < 0.025) {
      ctx.fillStyle = `rgba(255,200,200,${(baseAlpha * 0.7).toFixed(3)})`;
    } else {
      const r = (110 + Math.random() * 80) | 0;
      ctx.fillStyle = `rgba(${r},0,0,${baseAlpha.toFixed(3)})`;
    }

    const sz = danger > 0.5 && Math.random() < danger * 0.18 ? 2 : 1;
    ctx.fillRect(x | 0, y | 0, sz, sz);
  }

  // ── 3. Horizontal glitch scanlines ────────────────────────────────────────
  const glitches = Math.floor(danger * danger * 5);
  for (let i = 0; i < glitches; i++) {
    if (Math.random() > danger * 0.55) continue;
    const gy = (Math.random() * H) | 0;
    const gh = 1 + ((Math.random() * 3) | 0);
    const ga = 0.06 + Math.random() * 0.18;
    ctx.fillStyle = `rgba(200,0,0,${ga.toFixed(3)})`;
    ctx.fillRect(0, gy, W, gh);
  }

  // ── 4. Full-canvas flash at critical danger ────────────────────────────────
  if (danger > 0.82 && Math.random() < 0.035) {
    ctx.fillStyle = `rgba(160,0,0,${(Math.random() * 0.1).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // ── 5. Edge smear bands ───────────────────────────────────────────────────
  if (danger > 0.55) {
    const bw = (danger * danger * 12) | 0;
    const ba = danger * 0.10;
    ctx.fillStyle = `rgba(160,0,0,${ba.toFixed(3)})`;
    ctx.fillRect(0,    0, bw, H);
    ctx.fillRect(W-bw, 0, bw, H);
    ctx.fillRect(0, 0,    W, bw);
    ctx.fillRect(0, H-bw, W, bw);
  }
}
