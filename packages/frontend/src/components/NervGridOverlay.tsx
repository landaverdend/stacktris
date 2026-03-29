import { useEffect, useRef } from 'react';
import type { DangerSignal } from '../game/DangerSignal';

// Keep in sync with DangerSignal.ts COLOR constants
const BITCOIN = { r: 247, g: 147, b: 26 };
const ALERT   = { r: 204, g: 34,  b: 0  };

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function lerpCol(t: number) {
  return {
    r: Math.round(lerp(BITCOIN.r, ALERT.r, t)),
    g: Math.round(lerp(BITCOIN.g, ALERT.g, t)),
    b: Math.round(lerp(BITCOIN.b, ALERT.b, t)),
  };
}

interface Props {
  dangerSignal: DangerSignal | null;
}

export function NervGridOverlay({ dangerSignal }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const dangerRef  = useRef(0);

  // Subscribe to danger updates — write to ref, never to state
  useEffect(() => {
    if (!dangerSignal) return;
    dangerRef.current = dangerSignal.value;
    return dangerSignal.subscribe(v => { dangerRef.current = v; });
  }, [dangerSignal]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    let rafId: number;
    let angle = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const d = dangerRef.current;
      ctx.clearRect(0, 0, W, H);

      // Color + opacity ramp with danger
      const t   = Math.pow(d, 0.8);
      const col = lerpCol(t);
      const cr = col.r, cg = col.g, cb = col.b;

      const gridOpacity   = 0.08 + d * 0.14;
      const circleOpacity = 0.12 + d * 0.20;

      // ── Rectangular grid ────────────────────────────────────────────────────
      const CELL = 72;
      ctx.lineWidth   = 0.75;
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${gridOpacity})`;
      ctx.beginPath();
      for (let x = CELL; x < W; x += CELL) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = CELL; y < H; y += CELL) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();

      // ── Axis tick labels ─────────────────────────────────────────────────────
      const labelOpacity = gridOpacity * 1.6;
      ctx.font      = '8px "Share Tech Mono", monospace';
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${labelOpacity})`;

      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      let colNum = 1;
      for (let x = CELL; x < W; x += CELL * 2) {
        ctx.fillText(String(colNum).padStart(2, '0'), x, 4);
        colNum++;
      }

      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      let rowNum = 2;
      for (let y = CELL; y < H; y += CELL * 2) {
        ctx.fillText(String(rowNum).padStart(2, '0'), 20, y);
        rowNum += 2;
      }

      // ── Concentric circles (centered, slowly rotating) ──────────────────────
      const cx = W * 0.5;
      const cy = H * 0.5;
      // Rotation speed ramps up with danger
      angle += 0.00025 + d * 0.0015;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const maxR = Math.hypot(W, H) * 0.55;

      for (let r = 120; r < maxR; r += 130) {
        const fade = 1 - r / maxR;
        const op   = circleOpacity * fade * 2;

        // Circle arc
        ctx.lineWidth   = 1;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${op})`;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // Tick marks every 30°
        ctx.lineWidth   = 0.75;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${op * 1.4})`;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          const cos = Math.cos(a), sin = Math.sin(a);
          ctx.beginPath();
          ctx.moveTo(cos * (r - 9), sin * (r - 9));
          ctx.lineTo(cos * (r + 4), sin * (r + 4));
          ctx.stroke();
        }
      }

      // Cross-hair through circle origin
      const xr = maxR * 0.92;
      ctx.lineWidth   = 0.4;
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${circleOpacity * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(-xr, 0); ctx.lineTo(xr, 0);
      ctx.moveTo(0, -xr); ctx.lineTo(0, xr);
      ctx.stroke();

      ctx.restore();

      rafId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}
