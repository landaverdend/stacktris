import { useEffect, useRef } from 'react';

// ── Tetromino shapes defined as arrays of [x, y, z] unit-block positions ──────
const SHAPES: [number, number, number][][] = [
  // I
  [[-1.5, 0, 0], [-0.5, 0, 0], [0.5, 0, 0], [1.5, 0, 0]],
  // O
  [[-0.5, -0.5, 0], [0.5, -0.5, 0], [-0.5, 0.5, 0], [0.5, 0.5, 0]],
  // T
  [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [0, -1, 0]],
  // S
  [[0, 0, 0], [1, 0, 0], [-1, 1, 0], [0, 1, 0]],
  // Z
  [[-1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
  // J
  [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [1, -1, 0]],
  // L
  [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [-1, -1, 0]],
];

// Cube vertices (unit cube centered at origin)
const CUBE_VERTS: [number, number, number][] = [
  [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5],
  [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5],
  [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
];

// Cube edges (pairs of vertex indices)
const CUBE_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // back face
  [4, 5], [5, 6], [6, 7], [7, 4], // front face
  [0, 4], [1, 5], [2, 6], [3, 7], // connectors
];

// ── Math helpers ───────────────────────────────────────────────────────────────

type Vec3 = [number, number, number];

function rotateX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}
function rotateY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
function rotateZ(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

function project(v: Vec3, fov: number, ox: number, oy: number, scale: number): [number, number] {
  const z = v[2] + fov;
  const f = fov / (z === 0 ? 0.001 : z);
  return [ox + v[0] * f * scale, oy + v[1] * f * scale];
}

// ── Piece state ────────────────────────────────────────────────────────────────

interface Piece {
  shape: Vec3[];
  x: number;       // screen x anchor
  y: number;       // screen y anchor
  scale: number;
  rx: number; ry: number; rz: number;     // current rotation angles
  vx: number; vy: number; vz: number;     // rotation velocities
  opacity: number;
  fadeDir: number;
  fadeSpeed: number;
}

function makePiece(w: number, h: number, rng: () => number): Piece {
  // Place along the four border bands
  const band = Math.floor(rng() * 4);
  const margin = 80;
  let px: number, py: number;
  if (band === 0) { px = rng() * w; py = rng() * margin; }
  else if (band === 1) { px = rng() * w; py = h - rng() * margin; }
  else if (band === 2) { px = rng() * margin; py = rng() * h; }
  else { px = w - rng() * margin; py = rng() * h; }

  const shape = SHAPES[Math.floor(rng() * SHAPES.length)];

  return {
    shape: shape as Vec3[],
    x: px, y: py,
    scale: 18 + rng() * 22,
    rx: rng() * Math.PI * 2,
    ry: rng() * Math.PI * 2,
    rz: rng() * Math.PI * 2,
    vx: (rng() - 0.5) * 0.008,
    vy: (rng() - 0.5) * 0.008,
    vz: (rng() - 0.5) * 0.005,
    opacity: rng() * 0.3 + 0.05,
    fadeDir: rng() > 0.5 ? 1 : -1,
    fadeSpeed: 0.0003 + rng() * 0.0004,
  };
}

// Seeded-ish LCG so layout is deterministic on first render
function makeLCG(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

const PIECE_COUNT = 18;
const FOV = 5;

export function TetrominoBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pieces = useRef<Piece[]>([]);
  const raf = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Reinitialise pieces when size changes
      const rng = makeLCG(0xdeadbeef);
      pieces.current = Array.from({ length: PIECE_COUNT }, () =>
        makePiece(canvas.width, canvas.height, rng)
      );
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      for (const p of pieces.current) {
        // Rotate
        p.rx += p.vx;
        p.ry += p.vy;
        p.rz += p.vz;

        // Fade
        p.opacity += p.fadeDir * p.fadeSpeed;
        if (p.opacity > 0.38) { p.opacity = 0.38; p.fadeDir = -1; }
        if (p.opacity < 0.03) { p.opacity = 0.03; p.fadeDir = 1; }

        ctx.strokeStyle = `rgba(247,147,26,${p.opacity})`;
        ctx.lineWidth = 0.8;

        // Draw each block of the tetromino
        for (const [bx, by, bz] of p.shape) {
          // Project each cube vertex: rotate the whole piece, then project
          const projected = CUBE_VERTS.map(v => {
            let vv: Vec3 = [v[0] + bx, v[1] + by, v[2] + bz];
            vv = rotateX(vv, p.rx);
            vv = rotateY(vv, p.ry);
            vv = rotateZ(vv, p.rz);
            return project(vv, FOV, p.x, p.y, p.scale);
          });

          // Draw cube edges
          ctx.beginPath();
          for (const [a, b] of CUBE_EDGES) {
            ctx.moveTo(projected[a][0], projected[a][1]);
            ctx.lineTo(projected[b][0], projected[b][1]);
          }
          ctx.stroke();
        }
      }

      raf.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
