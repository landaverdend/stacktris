import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

const TEAL = 'rgba(0,255,180,0.92)';
const TEAL_GLOW = `0 0 8px rgba(0,255,180,0.7), 0 0 24px rgba(0,255,180,0.4)`;

const CYAN = '#00f0f0';
const CYAN_GLOW = `0 0 8px rgba(0,240,240,0.7), 0 0 24px rgba(0,240,240,0.4)`;

const PURPLE = '#a000f0';
const PURPLE_GLOW = `0 0 8px rgba(160,0,240,0.7), 0 0 24px rgba(160,0,240,0.4)`;

const T_SPIN_LABELS: Record<number, string> = { 1: 'T·SPIN SINGLE', 2: 'T·SPIN DOUBLE', 3: 'T·SPIN TRIPLE' };

export type ClearEvent = { key: number; isTSpin: boolean; lines: number };

interface Props {
  showB2b: boolean;
  clearEvent: ClearEvent | null;
}

function getClearDisplay(e: ClearEvent) {
  if (e.isTSpin) return { color: PURPLE, glow: PURPLE_GLOW, kanji: '回転', label: T_SPIN_LABELS[e.lines] ?? 'T·SPIN' };
  return { color: CYAN, glow: CYAN_GLOW, kanji: '完璧', label: 'TETRIS' };
}

export function ComboComponent({ showB2b, clearEvent }: Props) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<ClearEvent | null>(null);

  useEffect(() => {
    if (!clearEvent) return;
    setCurrent(clearEvent);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1900);
    return () => clearTimeout(t);
  }, [clearEvent?.key]);

  const display = current ? getClearDisplay(current) : null;

  return (
    <div className="absolute top-full left-0 w-full pointer-events-none flex flex-col" style={{ marginTop: 10, gap: 8 }}>

      {/* B2B slot — always on top */}
      <div className="flex flex-col items-center" style={{ minHeight: 64 }}>
        <AnimatePresence>
          {showB2b && (
            <motion.div
              className="flex flex-col items-center select-none w-full"
              initial={{ opacity: 0, scale: 0.6, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <motion.span
                className="font-jp leading-none"
                style={{ fontSize: 38, color: TEAL, textShadow: TEAL_GLOW }}
                animate={{ textShadow: [TEAL_GLOW, `0 0 18px rgba(0,255,180,1), 0 0 40px rgba(0,255,180,0.6)`, TEAL_GLOW] }}
                transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
              >
                連続
              </motion.span>
              <span
                className="font-display font-bold tracking-[0.14em] text-[11px] uppercase mt-0.5"
                style={{ color: TEAL, textShadow: TEAL_GLOW }}
              >
                BACK·TO·BACK
              </span>
              <motion.div
                className="mt-0.5"
                style={{ width: '80%', height: 1, background: TEAL, boxShadow: TEAL_GLOW }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Clear notification slot — Tetris or T-spin, always on bottom */}
      <div className="flex flex-col items-center" style={{ minHeight: 60 }}>
        <AnimatePresence>
          {visible && display && (
            <motion.div
              key={current?.key}
              className="flex flex-col items-center select-none w-full"
              initial={{ opacity: 0, scale: 0.5, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 6 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
            >
              <motion.span
                className="font-jp leading-none"
                style={{ fontSize: 36, color: display.color, textShadow: display.glow }}
                animate={{ textShadow: [display.glow, display.glow.replace('0.7', '1').replace('0.4', '0.8'), display.glow] }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              >
                {display.kanji}
              </motion.span>
              <span
                className="font-display font-bold tracking-[0.14em] text-[11px] uppercase mt-0.5"
                style={{ color: display.color, textShadow: display.glow }}
              >
                {display.label}
              </span>
              <motion.div
                className="mt-0.5"
                style={{ width: '80%', height: 1, background: display.color, boxShadow: display.glow }}
                animate={{ opacity: [1, 0.2, 1, 0.2, 0] }}
                transition={{ duration: 1.2, ease: 'linear' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
