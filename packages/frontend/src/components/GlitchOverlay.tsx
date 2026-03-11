import { useEffect, useRef } from 'react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function rn(min: number, max: number) { return min + Math.random() * (max - min); }
function ri(min: number, max: number) { return Math.floor(rn(min, max)); }
function pick<T>(arr: T[]): T { return arr[ri(0, arr.length)]; }
function hex(n: number) { return n.toString(16).toUpperCase().padStart(4, '0'); }

// ── Content pools ──────────────────────────────────────────────────────────────

const KANJI_FRAGS = [
  'システム', 'エラー', '警告', '接続', '認証', '起動', '停止', '解析',
  '同期', '転送', '受信', '送信', '制御', '監視', '暗号', '崩壊',
  'ネルフ', 'マギ', '初号機', '零号機', '弐号機',
];

const SYS_STRINGS = [
  () => `0x${hex(ri(0, 0xffff))}`,
  () => `ERR_${ri(100, 999)}`,
  () => `NODE_${ri(0, 255)}.${ri(0, 255)}.${ri(0, 255)}`,
  () => `${rn(0, 100).toFixed(2)}%`,
  () => `LAT:${rn(-90, 90).toFixed(4)}`,
  () => `LNG:${rn(-180, 180).toFixed(4)}`,
  () => `${ri(0, 9999).toString().padStart(4, '0')}ms`,
  () => `PKT#${ri(0, 99999)}`,
  () => `${ri(0, 255)}.${ri(0, 255)}.${ri(0, 255)}.${ri(0, 255)}`,
  () => `SYNC ${rn(0, 100).toFixed(1)}%`,
  () => `MAGI-0${ri(1, 4)}`,
  () => `UID:${hex(ri(0, 0xffff))}${hex(ri(0, 0xffff))}`,
  () => `[${ri(0, 9999).toString().padStart(4, '0')}]`,
  () => Array.from({ length: ri(6, 12) }, () => ri(0, 1)).join(''),
  () => pick(KANJI_FRAGS),
  () => `>> ${pick(['OK', 'FAIL', 'WARN', 'NULL', 'DEAD', 'INIT'])}`,
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface FloatText {
  x: number; y: number;
  text: string;
  opacity: number;
  targetOpacity: number;
  fadeSpeed: number;
  size: number;
  ttl: number;          // frames until refresh
  vx: number; vy: number;
  r: number; g: number; b: number;
}

interface ScanLine {
  y: number;
  opacity: number;
  speed: number;
  width: number;       // height of line
}

interface GlitchTear {
  y: number;
  h: number;
  offset: number;
  ttl: number;
}

// ── Component ──────────────────────────────────────────────────────────────────

const FLOAT_COUNT = 55;

// Color palette (mostly dim amber, occasional accent)
const COLORS: [number, number, number][] = [
  [247, 147, 26],   // amber (dominant)
  [247, 147, 26],
  [247, 147, 26],
  [0, 255, 180],    // cyan-green
  [168, 85, 247],   // purple
  [220, 38, 38],    // red
  [6, 182, 212],    // teal
];

export function GlitchOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0;
    let rafId = 0;
    let frame = 0;

    const floats: FloatText[] = [];
    const scanLines: ScanLine[] = [];
    const tears: GlitchTear[] = [];

    function makeFloat(): FloatText {
      const [r, g, b] = pick(COLORS);
      return {
        x: rn(0.02, 0.98) * W,
        y: rn(0.02, 0.98) * H,
        text: pick(SYS_STRINGS)(),
        opacity: 0,
        targetOpacity: rn(0.06, 0.28),
        fadeSpeed: rn(0.004, 0.015),
        size: pick([7, 7, 7, 8, 9, 10, 11]),
        ttl: ri(80, 300),
        vx: rn(-0.05, 0.05),
        vy: rn(-0.05, 0.05),
        r, g, b,
      };
    }

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    // Init float text
    for (let i = 0; i < FLOAT_COUNT; i++) floats.push(makeFloat());

    function render() {
      rafId = requestAnimationFrame(render);
      ctx.clearRect(0, 0, W, H);
      frame++;

      // ── Floating data strings ──────────────────────────────────────────────
      for (let i = 0; i < floats.length; i++) {
        const f = floats[i];

        f.x += f.vx;
        f.y += f.vy;
        f.ttl--;

        if (f.ttl <= 0) {
          // Fade out then reset
          f.targetOpacity = 0;
        }
        f.opacity += (f.targetOpacity - f.opacity) * f.fadeSpeed;

        if (f.ttl <= 0 && f.opacity < 0.01) {
          floats[i] = makeFloat();
          continue;
        }

        // Rapidly flicker some strings
        const flicker = f.size <= 8 && Math.random() < 0.08;
        const drawOp = flicker ? f.opacity * rn(0.1, 0.5) : f.opacity;

        // Occasionally swap text mid-life for chaos
        if (frame % ri(15, 40) === 0 && f.ttl > 20) {
          f.text = pick(SYS_STRINGS)();
        }

        ctx.font = `${f.size}px "Share Tech Mono", monospace`;
        ctx.fillStyle = `rgba(${f.r},${f.g},${f.b},${drawOp.toFixed(3)})`;
        ctx.textAlign = 'left';
        ctx.fillText(f.text, f.x, f.y);
      }

      // ── Scan lines (random horizontal flash) ──────────────────────────────
      if (Math.random() < 0.012) {
        scanLines.push({
          y: rn(0, H),
          opacity: rn(0.04, 0.18),
          speed: rn(1.5, 5),
          width: pick([1, 1, 1, 2, 3]),
        });
      }
      for (let i = scanLines.length - 1; i >= 0; i--) {
        const s = scanLines[i];
        s.y += s.speed;
        s.opacity -= 0.004;
        if (s.opacity <= 0 || s.y > H) { scanLines.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(247,147,26,${s.opacity.toFixed(3)})`;
        ctx.fillRect(0, s.y, W, s.width);
      }

      // ── Glitch tears (brief horizontal offset strips) ──────────────────────
      if (Math.random() < 0.004) {
        tears.push({
          y: rn(0.1, 0.9) * H,
          h: ri(2, 18),
          offset: (Math.random() < 0.5 ? -1 : 1) * rn(8, 60),
          ttl: ri(2, 8),
        });
      }
      for (let i = tears.length - 1; i >= 0; i--) {
        const t = tears[i];
        t.ttl--;
        if (t.ttl <= 0) { tears.splice(i, 1); continue; }
        // Draw a slightly offset copy of a slice (using the canvas itself as source is
        // expensive, so we just draw a colored rect for the glitch line impression)
        ctx.fillStyle = `rgba(247,147,26,0.04)`;
        ctx.fillRect(Math.max(0, t.offset), t.y, W, t.h);
        ctx.fillStyle = `rgba(0,255,180,0.03)`;
        ctx.fillRect(Math.max(0, -t.offset), t.y + 1, W, t.h);
      }

      // ── Random pixel noise clusters ────────────────────────────────────────
      if (frame % 3 === 0) {
        const clusters = ri(2, 6);
        for (let c = 0; c < clusters; c++) {
          const cx = rn(0, W), cy = rn(0, H);
          const count = ri(3, 12);
          for (let p = 0; p < count; p++) {
            const px = cx + rn(-8, 8), py = cy + rn(-8, 8);
            const [r, g, b] = Math.random() < 0.8 ? [247, 147, 26] : pick(COLORS);
            ctx.fillStyle = `rgba(${r},${g},${b},${rn(0.03, 0.12).toFixed(3)})`;
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }

      // ── Corner readout blocks (static-ish system data) ────────────────────
      if (frame % 30 === 0) {
        // Randomly reposition/refresh a few floats for the "data stream" effect
        const refreshCount = ri(2, 5);
        for (let i = 0; i < refreshCount; i++) {
          const idx = ri(0, floats.length);
          if (floats[idx]) floats[idx].text = pick(SYS_STRINGS)();
        }
      }
    }

    render();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 2 }}
    />
  );
}
