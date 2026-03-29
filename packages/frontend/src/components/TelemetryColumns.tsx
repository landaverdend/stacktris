import { useEffect, useRef } from 'react';
import type { DangerSignal } from '../game/DangerSignal';

const TERMINAL = { r: 0, g: 255, b: 65 }; // --color-terminal
const ALERT = { r: 204, g: 34, b: 0 }; // --color-alert

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function makeLCG(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff; };
}

function pad2(n: number) { return String(Math.floor(n)).padStart(2, '0'); }
function hex4(v: number) { return Math.floor(v * 0xffff).toString(16).toUpperCase().padStart(4, '0'); }

const STATUS = ['CONFIRM', 'PENDING', 'MEMPOOL', 'OP_SIZE', 'ORPHAND', 'SATOSHII', 'VALIDAT'];
const BIPS = ['BIP-141', 'BIP-340', 'BIP-032', 'BIP-039', 'BIP-044', 'BIP-174', 'BIP-068', 'BIP-112'];
const PROTOS = ['SEGWIT_', 'TAPROOT', 'SCHNORR', 'MUSIG-2', 'LN-HTLC', 'LN-BOLT', 'OP_CLTV', 'OP_CSV_'];

function genLine(rng: () => number): string {
  switch (Math.floor(rng() * 7)) {
    case 0: return `BLK:${Math.floor(rng() * 99999 + 800000)}`;
    case 1: return `0x${hex4(rng())}${hex4(rng())}`;
    case 2: return STATUS[Math.floor(rng() * STATUS.length)];
    case 3: return BIPS[Math.floor(rng() * BIPS.length)];
    case 4: return PROTOS[Math.floor(rng() * PROTOS.length)];
    default: return `${hex4(rng())}:${pad2(rng() * 99)}`;
  }
}

interface TLine { text: string; y: number; alpha: number; }

const LINE_H = 13;
const COL_PAD = 10;

interface Props { dangerSignal: DangerSignal | null; }

export function TelemetryColumns({ dangerSignal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dangerRef = useRef(0);

  useEffect(() => {
    if (!dangerSignal) return;
    dangerRef.current = dangerSignal.value;
    return dangerSignal.subscribe(v => { dangerRef.current = v; });
  }, [dangerSignal]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let rafId: number;

    const rng = makeLCG(0xc0ffee42);
    let left: TLine[] = [];
    let right: TLine[] = [];
    let H = 0;

    const initLines = () => {
      H = canvas.height = window.innerHeight;
      canvas.width = window.innerWidth;
      const n = Math.ceil(H / LINE_H) + 2;
      left = Array.from({ length: n }, (_, i) => ({ text: genLine(rng), y: i * LINE_H, alpha: 0.18 + rng() * 0.55 }));
      right = Array.from({ length: n }, (_, i) => ({ text: genLine(rng), y: i * LINE_H, alpha: 0.18 + rng() * 0.55 }));
    };
    initLines();
    window.addEventListener('resize', initLines);

    let prev = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      const W = canvas.width;
      const d = dangerRef.current;
      ctx.clearRect(0, 0, W, H);

      // Color
      const t = Math.pow(d, 0.6);
      const cr = Math.round(lerp(TERMINAL.r, ALERT.r, t));
      const cg = Math.round(lerp(TERMINAL.g, ALERT.g, t));
      const cb = Math.round(lerp(TERMINAL.b, ALERT.b, t));

      const speed = lerp(36, 110, d); // px / sec
      const move = speed * dt;

      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.textBaseline = 'top';

      const recycle = (lines: TLine[]) => {
        for (const ln of lines) {
          ln.y -= move;
          if (ln.y < -LINE_H) {
            ln.y += lines.length * LINE_H;
            ln.text = genLine(rng);
            ln.alpha = 0.18 + rng() * 0.55;
          }
        }
      };

      recycle(left);
      recycle(right);

      ctx.textAlign = 'left';
      for (const ln of left) {
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${ln.alpha})`;
        ctx.fillText(ln.text, COL_PAD, ln.y);
      }

      ctx.textAlign = 'right';
      for (const ln of right) {
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${ln.alpha})`;
        ctx.fillText(ln.text, W - COL_PAD, ln.y);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', initLines);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}
