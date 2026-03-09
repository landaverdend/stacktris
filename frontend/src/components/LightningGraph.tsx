import { useEffect, useRef } from 'react';
import * as d3Force from 'd3-force';

// ── Types ──────────────────────────────────────────────────────────────────────

interface GNode extends d3Force.SimulationNodeDatum {
  id: number;
  label: string;       // short hex or kanji label
  r: number;           // radius
  opacity: number;
  targetOpacity: number;
  dying: boolean;
}

interface GLink extends d3Force.SimulationLinkDatum<GNode> {
  source: GNode;
  target: GNode;
  opacity: number;
  pulses: Pulse[];
}

interface Pulse {
  t: number;    // 0..1 progress along the link
  speed: number;
  opacity: number;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const TARGET_NODES = 28;
const MAX_LINKS_PER_NODE = 3;
const ADD_INTERVAL = 2800;   // ms between node additions
const DIE_INTERVAL = 4200;   // ms between node removals
const PULSE_INTERVAL = 600;   // ms between pulse spawns per link

// Color palette: amber nodes, cyan-green edges, deep-blue glow
const COL_NODE = [247, 147, 26] as const;  // bitcoin amber — node core
const COL_PULSE = [0, 255, 180] as const;  // neon cyan-green — payment pulses
const COL_LINK = [0, 80, 60] as const;  // dark teal — link lines
const COL_GLOW = [0, 40, 120] as const;  // deep blue — node glow halo

function hex(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

const LABELS = [
  '稲妻', '電力', '閃光', '速度', '接続',
  '経路', '取引', '決済', '秘密', '信頼',
];

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
      return `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
    }

    // Draw a flat-top hexagon path centered at (cx, cy) with outer radius r
    function hexPath(cx: number, cy: number, r: number) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30); // flat-top
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    function addNode() {
      if (nodes.filter(n => !n.dying).length >= TARGET_NODES) return;
      const node: GNode = {
        id: nextId++,
        label: makeLabel(),
        r: 8 + Math.random() * 8,
        opacity: 0,
        targetOpacity: 0.3 + Math.random() * 0.5,
        dying: false,
        x: W * 0.05 + Math.random() * W * 0.9,
        y: H * 0.05 + Math.random() * H * 0.9,
      };
      nodes.push(node);

      // Connect to 1-3 random existing live nodes
      const candidates = nodes.filter(n => n !== node && !n.dying);
      const count = Math.min(1 + Math.floor(Math.random() * MAX_LINKS_PER_NODE), candidates.length);
      const targets = candidates.sort(() => Math.random() - 0.5).slice(0, count);
      for (const t of targets) {
        links.push({ source: node, target: t, opacity: 0, pulses: [] });
      }

      sim.nodes(nodes);
      (sim.force('link') as d3Force.ForceLink<GNode, GLink>).links(links);
      sim.alpha(0.15).restart();
    }

    function killRandomNode() {
      const live = nodes.filter(n => !n.dying);
      if (live.length <= 6) return;
      const victim = live[Math.floor(Math.random() * live.length)];
      victim.dying = true;
    }

    // ── Simulation setup ────────────────────────────────────────────────────────
    function initSim() {
      sim = d3Force.forceSimulation<GNode, GLink>([])
        .force('link', d3Force.forceLink<GNode, GLink>([])
          .id(d => d.id)
          .distance(160)
          .strength(0.2))
        .force('charge', d3Force.forceManyBody().strength(-320))
        .force('center', d3Force.forceCenter(W / 2, H / 2).strength(0.02))
        .force('collision', d3Force.forceCollide<GNode>(d => d.r + 32))
        .alphaDecay(0.015)
        .velocityDecay(0.7)
        .on('tick', () => { });  // we render manually in rAF

      // Seed initial nodes
      for (let i = 0; i < Math.floor(TARGET_NODES * 0.6); i++) addNode();
    }

    // ── Render loop ────────────────────────────────────────────────────────────

    let lastPulseTime = 0;
    let rafId = 0;

    function render(now: number) {
      rafId = requestAnimationFrame(render);

      ctx.clearRect(0, 0, W, H);

      // Fade / cleanup dying nodes
      const toRemove = new Set<GNode>();
      for (const n of nodes) {
        if (n.dying) {
          n.opacity -= 0.004;
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
        const candidates = links.filter(l => !l.source.dying && !l.target.dying);
        if (candidates.length) {
          const link = candidates[Math.floor(Math.random() * candidates.length)];
          link.pulses.push({ t: 0, speed: 0.004 + Math.random() * 0.004, opacity: 0.8 });
        }
      }

      // ── Draw links ──────────────────────────────────────────────────────────
      for (const link of links) {
        const s = link.source, t = link.target;
        if (s.x == null || s.y == null || t.x == null || t.y == null) continue;

        const lo = Math.min(s.opacity, t.opacity) * 0.4;
        link.opacity += (lo - link.opacity) * 0.05;

        // Link line
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = rgba(COL_LINK, link.opacity);
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Pulses — neon cyan-green dot racing along the channel
        link.pulses = link.pulses.filter(p => {
          p.t += p.speed;
          p.opacity -= p.speed * 0.8;
          if (p.t >= 1 || p.opacity <= 0) return false;

          const px = s.x! + (t.x! - s.x!) * p.t;
          const py = s.y! + (t.y! - s.y!) * p.t;

          // Glow trail around pulse
          const pg = ctx.createRadialGradient(px, py, 0, px, py, 5);
          pg.addColorStop(0, rgba(COL_PULSE, Math.min(p.opacity, 0.6)));
          pg.addColorStop(1, rgba(COL_PULSE, 0));
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = pg;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = rgba(COL_PULSE, Math.min(p.opacity, 1));
          ctx.fill();

          return true;
        });
      }

      // ── Draw nodes ──────────────────────────────────────────────────────────
      for (const n of nodes) {
        if (n.x == null || n.y == null) continue;
        const op = Math.max(0, Math.min(1, n.opacity));

        // Deep-blue wide halo (radial, still circular — halos look fine round)
        const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 7);
        halo.addColorStop(0,   rgba(COL_GLOW, op * 0.22));
        halo.addColorStop(0.4, rgba(COL_GLOW, op * 0.08));
        halo.addColorStop(1,   rgba(COL_GLOW, 0));
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 7, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        // Amber inner glow (radial)
        const inner = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2.8);
        inner.addColorStop(0, rgba(COL_NODE, op * 0.45));
        inner.addColorStop(1, rgba(COL_NODE, 0));
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = inner;
        ctx.fill();

        // Outer hexagon stroke — cyan
        hexPath(n.x, n.y, n.r + 4);
        ctx.strokeStyle = rgba(COL_PULSE, op * 0.25);
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Core hexagon — filled amber with dark interior
        hexPath(n.x, n.y, n.r);
        ctx.fillStyle = rgba(COL_NODE, op * 0.12);
        ctx.fill();
        ctx.strokeStyle = rgba(COL_NODE, op * 0.9);
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Centre dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = rgba(COL_NODE, op);
        ctx.fill();

        // Label — kanji in cyan, hex in amber
        const isKanji = /[^\x00-\x7F]/.test(n.label);
        ctx.font = `${Math.round(n.r * 0.7)}px "Share Tech Mono", monospace`;
        ctx.fillStyle = isKanji ? rgba(COL_PULSE, op * 0.6) : rgba(COL_NODE, op * 0.5);
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y - n.r - 6);
      }
    }

    // ── Resize ─────────────────────────────────────────────────────────────────

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      if (sim) sim.force('center', d3Force.forceCenter(W / 2, H / 2).strength(0.04));
    }

    resize();
    initSim();
    rafId = requestAnimationFrame(render);

    // Schedule node add / kill
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
