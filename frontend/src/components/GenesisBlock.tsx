import { useEffect, useRef, useState } from 'react';

// ── Genesis Block raw data ──────────────────────────────────────────────────

const BASE_LINES: [string, string, string][] = [
  ['00000000', '01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00', '................'],
  ['00000010', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00', '................'],
  ['00000020', '00 00 00 00 3B A3 ED FD 7A 7B 12 B2 7A C7 2C 3E', '....;£íýz{.²zÇ,>'],
  ['00000030', '67 76 8F 61 7F C8 1B C3 88 8A 51 32 3A 9F B8 AA', 'gv.a.È.ÃˆŠQ2:Ÿ¸ª'],
  ['00000040', '4B 1E 5E 4A 29 AB 5F 49 FF FF 00 1D 1D AC 2B 7C', 'K.^J)«_Iÿÿ...¬+|'],
  ['00000050', '01 01 00 00 00 01 00 00 00 00 00 00 00 00 00 00', '................'],
  ['00000060', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00', '................'],
  ['00000070', '00 00 00 00 00 00 FF FF FF FF 4D 04 FF FF 00 1D', '......ÿÿÿÿM.ÿÿ..'],
  ['00000080', '01 04 45 54 68 65 20 54 69 6D 65 73 20 30 33 2F', '..EThe Times 03/'],
  ['00000090', '4A 61 6E 2F 32 30 30 39 20 43 68 61 6E 63 65 6C', 'Jan/2009 Chancel'],
  ['000000A0', '6C 6F 72 20 6F 6E 20 62 72 69 6E 6B 20 6F 66 20', 'lor on brink of '],
  ['000000B0', '73 65 63 6F 6E 64 20 62 61 69 6C 6F 75 74 20 66', 'second bailout f'],
  ['000000C0', '6F 72 20 62 61 6E 6B 73 FF FF FF FF 01 00 F2 05', 'or banksÿÿÿÿ..ò.'],
  ['000000D0', '2A 01 00 00 00 43 41 04 67 8A FD B0 FE 55 48 27', "*....CA.gŠý°þUH'"],
  ['000000E0', '19 67 F1 A6 71 30 B7 10 5C D6 A8 28 E0 39 09 A6', '.gñ¦q0·.\\Ö¨(à9.¦'],
  ['000000F0', '79 62 E0 EA 1F 61 DE B6 49 F6 BC 3F 4C EF 38 C4', 'ybàê.aÞ¶Iö¼?Lï8Ä'],
  ['00000100', 'F3 55 04 E5 1E C1 12 DE 5C 38 4D F7 BA 0B 8D 57', 'óU.å.Á.Þ\\8M÷º..W'],
  ['00000110', '8A 4C 70 2B 6B F1 1D 5F AC 00 00 00 00', 'ŠLp+kñ._¬....'],
];

// Lines containing the Satoshi message
const MSG_LINES = new Set([8, 9, 10, 11, 12]);

// Character pools
const HEX_CHARS = '0123456789ABCDEF';
const CHAOS_ASCII = '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╚╔╩╦╠═╬■▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°√ⁿ²';
const KANJI_BOMBS = ['起動', '接続', '警告', 'ネルフ', '初号機', '崩壊', '転送', '中断', '消滅', '認証失敗'];
const ERR_BOMBS = ['// KERNEL PANIC', 'SEGFAULT 0x000', '>> NULL PTR', 'ERR_FATAL', 'ACCESS DENIED', '!CORRUPT'];

// ── Helpers ─────────────────────────────────────────────────────────────────

function corruptStr(s: string, rate: number, extra = ''): string {
  const pool = HEX_CHARS + extra;
  return s.split('').map(c => {
    if (c === ' ') return c;
    return Math.random() < rate ? pool[Math.floor(Math.random() * pool.length)] : c;
  }).join('');
}

function randFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Types ────────────────────────────────────────────────────────────────────

type LineColor = 'dim' | 'amber' | 'teal' | 'red' | 'white' | 'invisible';

interface DisplayLine {
  addr: string;
  hex: string;
  ascii: string;
  color: LineColor;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GenesisBlock() {
  const [lines, setLines] = useState<DisplayLine[]>(() =>
    BASE_LINES.map(([addr, hex, ascii]) => ({ addr, hex, ascii, color: 'dim' as LineColor }))
  );
  const [blockLabel, setBlockLabel] = useState('// GENESIS BLOCK — BLOCK #0 — SATOSHI');
  const [visible, setVisible] = useState(true);

  // Refs for animation state (avoid stale closures)
  const hardGlitchFrames = useRef(0);
  const msgHighlightFrames = useRef(0);
  const lineSeizures = useRef<Map<number, number>>(new Map()); // idx → frames remaining
  const frameCount = useRef(0);

  useEffect(() => {
    const BASE_LABELS = [
      '// GENESIS BLOCK — BLOCK #0 — SATOSHI',
      '// BLOCK:0 SHA256:000000000019D6',
      '// ブロック0 — 創世記 // NAKAMOTO',
      '// COINBASE TX — 50 BTC — UNSPENT',
      '// GENESIS BLOCK — BLOCK #0 — SATOSHI',
    ];

    function tick() {
      frameCount.current++;

      // ── Event triggers ────────────────────────────────────────────────────

      // Hard glitch bursts (every ~5–15s at 50ms tick = 100–300 frames)
      if (hardGlitchFrames.current <= 0 && Math.random() < 0.006) {
        hardGlitchFrames.current = 10 + Math.floor(Math.random() * 25);
        // Brief full-invisible "cut"
        if (Math.random() < 0.3) setVisible(false);
        setTimeout(() => setVisible(true), 60 + Math.random() * 100);
      }
      if (hardGlitchFrames.current > 0) hardGlitchFrames.current--;

      // Message highlight (Satoshi message glows)
      if (msgHighlightFrames.current <= 0 && Math.random() < 0.004) {
        msgHighlightFrames.current = 40 + Math.floor(Math.random() * 60);
      }
      if (msgHighlightFrames.current > 0) msgHighlightFrames.current--;

      // Random line seizures
      if (Math.random() < 0.035) {
        const idx = Math.floor(Math.random() * BASE_LINES.length);
        lineSeizures.current.set(idx, 2 + Math.floor(Math.random() * 5));
      }
      for (const [idx, rem] of lineSeizures.current) {
        if (rem <= 1) lineSeizures.current.delete(idx);
        else lineSeizures.current.set(idx, rem - 1);
      }

      // Header label chaos
      if (Math.random() < 0.02) {
        setBlockLabel(randFrom(BASE_LABELS));
      }

      // ── Build new line state ──────────────────────────────────────────────

      setLines(prev => prev.map((_, i): DisplayLine => {
        const [baseAddr, baseHex, baseAscii] = BASE_LINES[i];
        const isMsg = MSG_LINES.has(i);
        const isSeizing = lineSeizures.current.has(i);
        const isHardGlitch = hardGlitchFrames.current > 0;
        const isMsgGlow = msgHighlightFrames.current > 0 && isMsg;

        let addr = baseAddr;
        let hex = baseHex;
        let ascii = baseAscii;
        let color: LineColor = 'dim';

        if (isSeizing) {
          // Full line seizure — bomb or scramble
          const bombRoll = Math.random();
          if (bombRoll < 0.2) {
            // Kanji bomb
            const bomb = randFrom(KANJI_BOMBS);
            hex = bomb + ' '.repeat(Math.max(0, 47 - bomb.length));
            ascii = '▓▓▓▓▓▓▓▓';
          } else if (bombRoll < 0.35) {
            // Error bomb
            const bomb = randFrom(ERR_BOMBS);
            hex = bomb + ' '.repeat(Math.max(0, 47 - bomb.length));
            ascii = '!!ERROR!!';
          } else {
            hex = corruptStr(baseHex, 0.75, CHAOS_ASCII);
            ascii = corruptStr(baseAscii, 0.85, '?!@#$%&');
          }
          addr = Math.random() < 0.4 ? corruptStr(baseAddr, 0.5) : baseAddr;
          color = Math.random() < 0.5 ? 'red' : (Math.random() < 0.5 ? 'teal' : 'white');

        } else if (isHardGlitch) {
          const rate = 0.12 + Math.random() * 0.35;
          hex = corruptStr(baseHex, rate, CHAOS_ASCII);
          ascii = corruptStr(baseAscii, rate * 0.6, '?!#$');
          if (Math.random() < 0.15) addr = corruptStr(baseAddr, 0.4);
          const r = Math.random();
          if (r < 0.15) color = 'red';
          else if (r < 0.25) color = 'white';
          else if (r < 0.05) color = 'invisible';
          else color = 'dim';

        } else if (isMsgGlow) {
          hex = corruptStr(baseHex, 0.02);
          color = 'teal';

        } else {
          // Normal idle: very subtle corruption
          hex = corruptStr(baseHex, 0.012);
          ascii = corruptStr(baseAscii, 0.006, '?');
          // Rare random color flash
          const r = Math.random();
          if (r < 0.004) color = 'amber';
          else if (r < 0.002) color = 'red';
          else if (r < 0.001) color = 'teal';
          else color = 'dim';
        }

        return { addr, hex, ascii, color };
      }));
    }

    const iv = setInterval(tick, 50);
    return () => clearInterval(iv);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed pointer-events-none select-none"
      style={{ top: '72px', right: '12px', zIndex: 3 }}
    >
      <div className="flex flex-col" style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: '7.5px', lineHeight: '1.45' }}>

        {/* Header */}
        <div style={{ color: 'rgba(247,147,26,0.35)', letterSpacing: '0.12em', marginBottom: '4px', fontSize: '7px' }}>
          {blockLabel}
        </div>

        {/* Hex lines */}
        {lines.map((line, i) => {
          const col = lineColor(line.color);
          const isMsg = MSG_LINES.has(i);
          return (
            <div key={i} className="flex gap-2 whitespace-pre" style={{ color: col, opacity: line.color === 'invisible' ? 0 : 1 }}>
              <span style={{ opacity: 0.35 }}>{line.addr}</span>
              <span style={{ opacity: isMsg && line.color === 'teal' ? 0.9 : 0.65 }}>{line.hex}</span>
              <span style={{ opacity: isMsg && line.color === 'teal' ? 0.85 : 0.4 }}>{line.ascii}</span>
            </div>
          );
        })}

        {/* Footer */}
        <div style={{ color: 'rgba(0,170,85,0.25)', letterSpacing: '0.1em', marginTop: '4px', fontSize: '7px' }}>
          ブロック0 // 創世記 // 2009.01.03
        </div>

      </div>
    </div>
  );
}

function lineColor(c: LineColor): string {
  switch (c) {
    case 'amber':     return 'rgba(247,147,26,0.9)';
    case 'teal':      return 'rgba(0,255,180,0.85)';
    case 'red':       return 'rgba(220,38,38,0.9)';
    case 'white':     return 'rgba(220,255,255,0.95)';
    case 'invisible': return 'transparent';
    case 'dim':
    default:          return 'rgba(247,147,26,0.22)';
  }
}
