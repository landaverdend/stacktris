import { AnimatePresence, motion } from 'motion/react';
import { WINS_TO_MATCH } from '@stacktris/shared';
import { NervButton } from '../../components/NervButton';
import { Divider } from '../../components/Divider';
import { SplitSessionState } from './useSplitSession';

function WinPips({ wins, target }: { wins: number; target: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: target }, (_, i) => (
        <span key={i} className={`text-sm ${i < wins ? 'text-teal' : 'text-phosphor/15'}`}>●</span>
      ))}
    </div>
  );
}

function ScoreTable({ wins, playerCount }: { wins: Record<string, number>; playerCount: number }) {
  return (
    <div className="flex flex-col gap-2.5 w-full">
      {Array.from({ length: playerCount }, (_, i) => {
        const pid = `p${i + 1}`;
        const w = wins[pid] ?? 0;
        return (
          <div key={pid} className="flex items-center gap-4">
            <span className="font-display font-bold text-xl tracking-[0.08em] text-phosphor/50 w-8">P{i + 1}</span>
            <WinPips wins={w} target={WINS_TO_MATCH} />
            <span className="font-mono text-[10px] text-[rgba(0,255,180,0.35)] tracking-widest ml-auto">{w}W</span>
          </div>
        );
      })}
    </div>
  );
}

// Corner bracket accents — mirrors the NervModal aesthetic
function Corners() {
  return (
    <>
      <div className="nerv-modal-corner nerv-modal-corner-tl" />
      <div className="nerv-modal-corner nerv-modal-corner-tr" />
      <div className="nerv-modal-corner nerv-modal-corner-bl" />
      <div className="nerv-modal-corner nerv-modal-corner-br" />
    </>
  );
}

const panelVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -16, scale: 0.98, transition: { duration: 0.2, ease: 'easeIn' } },
};

const backdropVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22 } },
  exit:    { opacity: 0, transition: { duration: 0.22 } },
};

type Props = {
  session: SplitSessionState;
  onPlayAgain: () => void;
  onMainMenu: () => void;
};

export function SplitOverlay({ session, onPlayAgain, onMainMenu }: Props) {
  const { potSats, buyIn, snapshot } = session;
  const { status, roundId, roundWinnerId, matchWinnerId, countdown, wins, playerCount } = snapshot;

  const isIntermission = status === 'intermission';
  const isFinished = status === 'finished';
  const show = isIntermission || isFinished;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={isFinished ? 'finished' : `round-${roundId}`}
          className="fixed inset-0 z-50 flex items-center justify-center"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(3px)' }}
        >
          <motion.div
            className="relative bg-black nerv-border flex flex-col items-center gap-0 overflow-hidden"
            style={{ minWidth: 380 }}
            variants={panelVariants}
          >
            {/* Scan sweep on entry */}
            <div className="nerv-modal-sweep" />
            <Corners />

            {/* ── Header ── */}
            <div className="w-full flex flex-col items-center gap-1 px-10 pt-8 pb-5">
              <div className="flex items-center gap-2">
                <span className="nerv-modal-indicator" />
                <span className="font-mono text-[10px] tracking-[0.35em] text-[rgba(0,255,180,0.5)] uppercase">
                  {isFinished ? 'Match Complete' : `Round ${roundId} Complete`}
                </span>
              </div>
            </div>

            <Divider color="teal" height={1} className="w-full opacity-20" />

            {/* ── Winner announcement ── */}
            <div className="w-full flex flex-col items-center gap-1 px-10 py-7">
              {isIntermission && (
                roundWinnerId === null ? (
                  <>
                    <span className="font-display font-bold tracking-[0.06em] text-phosphor" style={{ fontSize: '3.2rem', lineHeight: 1 }}>
                      DRAW
                    </span>
                    <span className="font-jp text-[14px] text-[rgba(0,255,180,0.35)] mt-1">引き分け</span>
                  </>
                ) : (
                  <>
                    <span
                      className="font-display font-bold tracking-[0.06em] text-phosphor"
                      style={{
                        fontSize: '4rem',
                        lineHeight: 1,
                        textShadow: '0 0 6px rgba(200,168,130,0.6), 0 0 24px rgba(200,168,130,0.25)',
                      }}
                    >
                      {roundWinnerId.replace('p', 'P')}
                    </span>
                    <span className="font-display font-bold text-xl tracking-[0.14em] text-bitcoin/80 mt-1">
                      WINS ROUND
                    </span>
                    <span className="font-jp text-[13px] text-[rgba(0,255,180,0.35)] mt-0.5">勝利</span>
                  </>
                )
              )}

              {isFinished && (
                matchWinnerId === null ? (
                  <>
                    <span className="font-display font-bold tracking-[0.06em] text-phosphor" style={{ fontSize: '3.2rem', lineHeight: 1 }}>
                      DRAW
                    </span>
                    <span className="font-jp text-[14px] text-[rgba(0,255,180,0.35)] mt-1">引き分け</span>
                  </>
                ) : (
                  <>
                    <span
                      className="font-display font-bold tracking-[0.08em] text-phosphor"
                      style={{
                        fontSize: '5rem',
                        lineHeight: 1,
                        textShadow: '0 0 8px rgba(200,168,130,0.7), 0 0 32px rgba(200,168,130,0.3)',
                      }}
                    >
                      {matchWinnerId.replace('p', 'P')}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.3em] text-teal mt-2 uppercase">Wins the Match</span>
                    <span className="font-jp text-[13px] text-[rgba(0,255,180,0.35)] mt-0.5">勝者</span>
                    {buyIn > 0 && (
                      <span className="font-mono text-[10px] tracking-[0.2em] text-bitcoin/70 mt-3 nerv-modal-blink">
                        ↳ PAYING OUT {potSats} SATS
                      </span>
                    )}
                  </>
                )
              )}
            </div>

            <Divider color="teal" height={1} className="w-full opacity-10" />

            {/* ── Score table ── */}
            <div className="w-full px-10 py-5">
              <ScoreTable wins={wins} playerCount={playerCount} />
            </div>

            <Divider color="teal" height={1} className="w-full opacity-10" />

            {/* ── Footer ── */}
            <div className="w-full px-10 py-5 flex flex-col items-center gap-4">
              {isIntermission && (
                <div className="flex items-center gap-2">
                  <span className="nerv-modal-indicator" style={{ width: 5, height: 5 }} />
                  <span className="font-mono text-[10px] tracking-[0.3em] text-[rgba(0,255,180,0.45)] uppercase">
                    Next Round In {countdown}
                  </span>
                </div>
              )}

              {isFinished && (
                <div className="flex flex-col gap-3 w-full">
                  <NervButton onClick={onPlayAgain}>PLAY AGAIN</NervButton>
                  <button
                    onClick={onMainMenu}
                    className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor/30 hover:text-alert transition-colors cursor-pointer text-center py-2">
                    MAIN MENU
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
