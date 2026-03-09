import { useEffect, useRef } from 'react';
import * as d3Force from 'd3-force';

// ── Types ──────────────────────────────────────────────────────────────────────

interface GNode extends d3Force.SimulationNodeDatum {
  id: number;
  label: string;
  r: number;
  opacity: number;
  targetOpacity: number;
  dying: boolean;
  deathKanji: string | null;   // shown when dying begins
  deathFlash: number;          // 0..1, drives the red flash
  deathTextY: number;          // floats upward
}

interface GLink extends d3Force.SimulationLinkDatum<GNode> {
  source: GNode;
  target: GNode;
  opacity: number;
  pulses: Pulse[];
}

interface Pulse {
  t: number;      // head position 0..1 along the link
  speed: number;
  opacity: number;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const TARGET_NODES = 35;
const MAX_LINKS_PER_NODE = 3;
const ADD_INTERVAL = 4000;
const DIE_INTERVAL = 4000;
const PULSE_INTERVAL = 300;  // ms between spawns
const PULSE_BURST = 1;    // pulses per spawn

// Colors
const COL_NODE = [247, 147, 26] as const;  // amber
const COL_PULSE = [0, 255, 180] as const;  // neon cyan-green
const COL_WHITE = [220, 255, 255] as const;  // near-white core
const COL_LINK = [0, 120, 90] as const;  // teal channel

function hex(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

const LABELS = ['稲妻', '電力', '閃光', '速度', '接続', '経路', '取引', '決済', '秘密', '信頼'];
const DEATH_KANJI = ['切断', 'オフライン', '消滅', '停止', 'エラー', '終了', '失敗', '崩壊'];

function makeLabel() {
  return Math.random() > 0.5 ? LABELS[Math.floor(Math.random() * LABELS.length)] : hex(6);
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LightningGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    let W = 0, H = 0;
    let nodes: GNode[] = [];
    let links: GLink[] = [];
    let nextId = 0;
    let sim: d3Force.Simulation<GNode, GLink>;

    // ── Helpers ────────────────────────────────────────────────────────────────

    function rgba(col: readonly [number, number, number], a: number) {
      return `rgba(${col[0]},${col[1]},${col[2]},${Math.max(0, a).toFixed(3)})`;
    }

    function hexPath(cx: number, cy: number, r: number) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    // ── Node management ────────────────────────────────────────────────────────

    function addNode() {
      if (nodes.filter(n => !n.dying).length >= TARGET_NODES) return;
      const node: GNode = {
        id: nextId++,
        label: makeLabel(),
        r: 8 + Math.random() * 8,
        opacity: 0,
        targetOpacity: 0.3 + Math.random() * 0.5,
        dying: false,
        deathKanji: null,
        deathFlash: 0,
        deathTextY: 0,
        x: W * 0.05 + Math.random() * W * 0.9,
        y: H * 0.05 + Math.random() * H * 0.9,
      };
      nodes.push(node);

      const candidates = nodes.filter(n => n !== node && !n.dying);
      const count = Math.min(1 + Math.floor(Math.random() * MAX_LINKS_PER_NODE), candidates.length);
      candidates.sort(() => Math.random() - 0.5).slice(0, count).forEach(t => {
        links.push({ source: node, target: t, opacity: 0, pulses: [] });
      });

      sim.nodes(nodes);
      (sim.force('link') as d3Force.ForceLink<GNode, GLink>).links(links);
      sim.alpha(0.15).restart();
    }

    function killRandomNode() {
      const live = nodes.filter(n => !n.dying);
      if (live.length <= 6) return;
      const victim = live[Math.floor(Math.random() * live.length)];
      victim.dying = true;
      victim.deathKanji = DEATH_KANJI[Math.floor(Math.random() * DEATH_KANJI.length)];
      victim.deathFlash = 1;
      victim.deathTextY = victim.y ?? 0;
    }

    // ── Simulation ─────────────────────────────────────────────────────────────

    function initSim() {
      sim = d3Force.forceSimulation<GNode, GLink>([])
        .force('link', d3Force.forceLink<GNode, GLink>([])
          .id(d => d.id).distance(160).strength(0.2))
        .force('charge', d3Force.forceManyBody().strength(-320))
        .force('center', d3Force.forceCenter(W * 0.3, H / 2).strength(0.02))
        .force('collision', d3Force.forceCollide<GNode>(d => d.r + 32))
        .alphaDecay(0.015)
        .velocityDecay(0.7)
        .on('tick', () => { });

      for (let i = 0; i < Math.floor(TARGET_NODES * 0.6); i++) addNode();
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    let lastPulseTime = 0;
    let rafId = 0;

    function render(now: number) {
      rafId = requestAnimationFrame(render);
      ctx.clearRect(0, 0, W, H);

      // Fade / cleanup
      const toRemove = new Set<GNode>();
      for (const n of nodes) {
        if (n.dying) {
          // Flash for first ~40% of death, then fade
          if (n.deathFlash > 0) n.deathFlash -= 0.025;
          n.deathTextY -= 0.4;  // float upward
          if (n.deathFlash <= 0) { n.opacity -= 0.006; }
          if (n.opacity <= 0) toRemove.add(n);
        } else {
          n.opacity += (n.targetOpacity - n.opacity) * 0.03;
        }
      }
      if (toRemove.size) {
        nodes = nodes.filter(n => !toRemove.has(n));
        links = links.filter(l => !toRemove.has(l.source) && !toRemove.has(l.target));
        sim.nodes(nodes);
        (sim.force('link') as d3Force.ForceLink<GNode, GLink>).links(links);
      }

      // Spawn pulses
      if (now - lastPulseTime > PULSE_INTERVAL) {
        lastPulseTime = now;
        const alive = links.filter(l => !l.source.dying && !l.target.dying);
        if (alive.length) {
          for (let b = 0; b < PULSE_BURST; b++) {
            const link = alive[Math.floor(Math.random() * alive.length)];
            link.pulses.push({ t: 0, speed: 0.014 + Math.random() * 0.02, opacity: 1 });
          }
        }
      }

      // ── Draw links ──────────────────────────────────────────────────────────
      for (const link of links) {
        const s = link.source, t = link.target;
        if (s.x == null || s.y == null || t.x == null || t.y == null) continue;

        const lo = Math.min(s.opacity, t.opacity);
        link.opacity += (lo * 0.65 - link.opacity) * 0.05;

        // Wide dim glow underlay
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = rgba(COL_LINK, link.opacity * 0.3);
        ctx.lineWidth = 3;
        ctx.stroke();

        // Sharp channel line
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = rgba(COL_LINK, link.opacity);
        ctx.lineWidth = 1;
        ctx.stroke();

        // ── Pulses ───────────────────────────────────────────────────────────
        link.pulses = link.pulses.filter(p => {
          p.t += p.speed;
          p.opacity -= p.speed * 1.1;
          if (p.t >= 1 || p.opacity <= 0) return false;

          const px = s.x! + (t.x! - s.x!) * p.t;
          const py = s.y! + (t.y! - s.y!) * p.t;

          // Outer glow
          const pg = ctx.createRadialGradient(px, py, 0, px, py, 6);
          pg.addColorStop(0, rgba(COL_PULSE, p.opacity * 0.5));
          pg.addColorStop(1, rgba(COL_PULSE, 0));
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.fillStyle = pg;
          ctx.fill();

          // Core dot
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = rgba(COL_WHITE, p.opacity);
          ctx.fill();

          return true;
        });
      }

      // ── Draw nodes ──────────────────────────────────────────────────────────
      const COL_RED = [220, 30, 30] as const;

      for (const n of nodes) {
        if (n.x == null || n.y == null) continue;
        const op = Math.max(0, Math.min(1, n.opacity));

        const isDying = n.dying && n.deathFlash > 0;
        // Alternate between red and near-white for a strobe effect
        const flashStrobe = isDying && Math.floor(now / 60) % 2 === 0;
        const nodeCol = isDying ? (flashStrobe ? [255, 80, 80] as const : COL_RED) : COL_NODE;
        const ringCol = isDying ? COL_RED : COL_PULSE;

        // Outer hex ring
        hexPath(n.x, n.y, n.r + 4);
        ctx.strokeStyle = rgba(ringCol, isDying ? n.deathFlash * 0.8 : op * 0.3);
        ctx.lineWidth = isDying ? 1.5 : 0.8;
        ctx.stroke();

        // Core hex
        hexPath(n.x, n.y, n.r);
        ctx.fillStyle = rgba(nodeCol, isDying ? n.deathFlash * 0.25 : op * 0.12);
        ctx.fill();
        ctx.strokeStyle = rgba(nodeCol, isDying ? n.deathFlash * 0.95 : op * 0.9);
        ctx.lineWidth = isDying ? 2 : 1.2;
        ctx.stroke();

        // Centre dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = rgba(nodeCol, isDying ? n.deathFlash : op);
        ctx.fill();

        // Normal label (hidden while dying)
        if (!n.dying) {
          const isKanji = /[^\x00-\x7F]/.test(n.label);
          ctx.font = `${Math.round(n.r * 0.7)}px "Share Tech Mono", monospace`;
          ctx.fillStyle = isKanji ? rgba(COL_PULSE, op * 0.6) : rgba(COL_NODE, op * 0.5);
          ctx.textAlign = 'center';
          ctx.fillText(n.label, n.x, n.y - n.r - 6);
        }

        // Death kanji — floats upward, red, fades with deathFlash
        if (n.dying && n.deathKanji) {
          const textOp = Math.max(0, n.deathFlash);
          const textY = n.deathTextY - n.r - 8;
          ctx.font = `bold ${Math.round(n.r * 1.1)}px "Noto Sans JP", sans-serif`;
          ctx.fillStyle = rgba(COL_RED, textOp);
          ctx.textAlign = 'center';
          ctx.fillText(n.deathKanji, n.x, textY);

          // "OFFLINE" beneath in mono
          ctx.font = `${Math.round(n.r * 0.6)}px "Share Tech Mono", monospace`;
          ctx.fillStyle = rgba(COL_RED, textOp * 0.6);
          ctx.fillText('// OFFLINE', n.x, textY + n.r * 1.2);
        }
      }
    }

    // ── Resize ─────────────────────────────────────────────────────────────────

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      if (sim) sim.force('center', d3Force.forceCenter(W * 0.3, H / 2).strength(0.02));
    }

    resize();
    initSim();
    rafId = requestAnimationFrame(render);

    const addTimer = setInterval(addNode, ADD_INTERVAL);
    const killTimer = setInterval(killRandomNode, DIE_INTERVAL);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(addTimer);
      clearInterval(killTimer);
      window.removeEventListener('resize', resize);
      sim.stop();
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
