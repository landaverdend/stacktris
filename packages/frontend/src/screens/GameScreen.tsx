import { useEffect, useRef, useState } from 'react';
import { useGameClient } from '../hooks/useGameClient';
import { BoardCanvas } from '../components/BoardCanvas';
import { QueueCanvas } from '../components/QueueCanvas';
import { HoldCanvas } from '../components/HoldCanvas';
import { GarbageMeter } from '../components/GarbageMeter';

// Delayed Auto Shift: how long (ms) to hold a key before auto-repeat begins.
const DAS_MS = 150;
const EMPTY_BOARD = Array.from({ length: 20 }, () => new Array(10).fill(0));
// Auto Repeat Rate: interval (ms) between repeated moves once DAS fires.
const ARR_MS = 33;

interface Props {
  onExitToLobby: () => void;
}

export function GameScreen({ onExitToLobby }: Props) {
  const { state, client } = useGameClient();
  const { gameStatus } = state;

  // Refs so timer IDs are accessible inside event handlers without re-registering.
  const dasTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const heldKey = useRef<string | null>(null);

  // Countdown tick: counts down from `from` to 0 (or "GO!").
  const [countdownDisplay, setCountdownDisplay] = useState<number | 'GO!' | null>(null);

  useEffect(() => {
    if (gameStatus.status !== 'countdown') {
      setCountdownDisplay(null);
      return;
    }
    let n = gameStatus.from;
    setCountdownDisplay(n);
    const iv = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdownDisplay(n);
      } else {
        setCountdownDisplay('GO!');
        clearInterval(iv);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [gameStatus.status, gameStatus.status === 'countdown' ? gameStatus.from : 0]);

  useEffect(() => {
    if (gameStatus.status !== 'playing') return;

    const clearDasArr = () => {
      if (dasTimer.current !== null) { clearTimeout(dasTimer.current); dasTimer.current = null; }
      if (arrTimer.current !== null) { clearInterval(arrTimer.current); arrTimer.current = null; }
      heldKey.current = null;
    };

    const startDasArr = (action: { type: 'move_left' | 'move_right' }) => {
      clearDasArr();
      heldKey.current = action.type;
      // Fire immediately, then start DAS countdown.
      client.sendAction(action);
      dasTimer.current = setTimeout(() => {
        dasTimer.current = null;
        arrTimer.current = setInterval(() => {
          client.sendAction(action);
        }, ARR_MS);
      }, DAS_MS);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // browser repeat — we handle our own
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        startDasArr({ type: 'move_left' });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        startDasArr({ type: 'move_right' });
      } else if (e.key === 'ArrowUp' || e.key === 'x') {
        e.preventDefault();
        client.sendAction({ type: 'rotate_cw' });
      } else if (e.key === 'z') {
        e.preventDefault();
        client.sendAction({ type: 'rotate_ccw' });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        client.sendAction({ type: 'soft_drop' });
      } else if (e.key === ' ') {
        e.preventDefault();
        client.sendAction({ type: 'hard_drop' });
      } else if (e.key === 'c') {
        e.preventDefault();
        client.sendAction({ type: 'hold' });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (
        (e.key === 'ArrowLeft' && heldKey.current === 'move_left') ||
        (e.key === 'ArrowRight' && heldKey.current === 'move_right')
      ) {
        clearDasArr();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearDasArr();
    };
  }, [gameStatus.status, client]);

  const handleGoToLobby = () => {
    client.goToLobby();
    onExitToLobby();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 pt-10">

      {/* ── Waiting ── */}
      {gameStatus.status === 'waiting_opponent' && (
        <div className="flex items-start justify-center gap-10 w-full">
          {/* Idle arena */}
          <div className="flex items-start gap-3 opacity-40">
            <HoldCanvas holdPiece={null} dimmed />
            <div className="flex items-end gap-1">
              <GarbageMeter pendingGarbage={0} />
              <BoardCanvas board={EMPTY_BOARD} activePiece={null} label="OPERATIVE // あなた" />
            </div>
            <QueueCanvas nextPieces={[]} />
          </div>

          {/* Ready-up panel */}
          <MissionStaging
            roomId={gameStatus.roomId}
            myIndex={gameStatus.myIndex}
            players={gameStatus.players}
            onToggleReady={() => {
              const myPlayer = gameStatus.players.find(p => p.index === gameStatus.myIndex);
              client.setReady(!(myPlayer?.ready ?? false));
            }}
            onAbort={handleGoToLobby}
          />
        </div>
      )}

      {/* ── Countdown ── */}
      {gameStatus.status === 'countdown' && (
        <div className="flex items-start gap-3">
          <HoldCanvas holdPiece={null} dimmed />
          <div className="flex items-end gap-1">
            <GarbageMeter pendingGarbage={0} />
            <div className="relative">
              <BoardCanvas board={EMPTY_BOARD} activePiece={null} label="OPERATIVE // あなた" />
              {/* Countdown overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                <p className="text-nerv-dim text-[9px] font-mono tracking-[0.4em]">
                  // COMBAT SEQUENCE INITIATING
                </p>
                <p
                  className="text-bitcoin font-display font-bold leading-none"
                  style={{ fontSize: '7rem' }}
                >
                  {countdownDisplay}
                </p>
                <p className="text-nerv-dim text-[8px] font-jp tracking-widest">
                  準備完了 — MAGI SYNC COMPLETE
                </p>
              </div>
            </div>
          </div>
          <QueueCanvas nextPieces={[]} />
        </div>
      )}

      {/* ── Playing ── */}
      {gameStatus.status === 'playing' && (
        <div className="relative flex flex-col items-center w-full pt-2 gap-2">

          {/* ── Top NERV status strip ── */}
          <div className="flex items-center gap-5 text-[8px] font-mono tracking-[0.28em] select-none">
            <span className="text-nerv-dim/50">// COMBAT ACTIVE</span>
            <span className="text-nerv-dim/30">◈ NERV HQ</span>
            <span className="text-nerv-dim/40">MAGI SYNC: NOMINAL</span>
            {gameStatus.your.pending_garbage > 0 ? (
              <span className="text-alert/80 animate-pulse font-bold">
                ⚠ INCOMING ATK: {gameStatus.your.pending_garbage}L
              </span>
            ) : (
              <span className="text-magi/40">AT FIELD: NOMINAL</span>
            )}
          </div>

          {/* ── Main arena ── */}
          <div className="relative flex items-start justify-center w-full">

            {/* Player side */}
            <div className="flex items-start gap-3">
              <HoldCanvas
                holdPiece={gameStatus.your.hold_piece}
                dimmed={gameStatus.your.hold_used}
              />
              <div className="flex items-end gap-1">
                <GarbageMeter pendingGarbage={gameStatus.your.pending_garbage} />
                <div className="flex flex-col gap-1.5">
                  <BoardCanvas
                    board={gameStatus.your.board}
                    activePiece={gameStatus.your.current_piece}
                    label="OPERATIVE // あなた"
                  />
                  {/* Score readout */}
                  <div className="nerv-frame flex justify-between items-center px-2 py-1.5">
                    <div className="flex flex-col gap-0">
                      <span className="text-nerv-dim/60 text-[8px] font-mono tracking-[0.3em]">SCORE</span>
                      <span className="text-bitcoin font-mono font-bold text-sm leading-none">
                        {gameStatus.your.score.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-px h-5 bg-border" />
                    <div className="flex flex-col gap-0 items-end">
                      <span className="text-nerv-dim/60 text-[8px] font-mono tracking-[0.3em]">LEVEL</span>
                      <span className="text-bitcoin font-mono font-bold text-sm leading-none">
                        {gameStatus.your.level}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <QueueCanvas nextPieces={gameStatus.your.next_pieces} />
            </div>

            {/* Opponent mini panel — top-right */}
            <div className="absolute top-0 right-4 flex flex-col gap-1">
              <p className="text-nerv-dim/50 text-[8px] font-mono tracking-[0.3em]">// HOSTILE UNIT</p>
              <div className="nerv-frame p-0.5">
                <BoardCanvas
                  board={gameStatus.opponent.board}
                  label="ADVERSARY"
                  scale={0.4}
                />
              </div>
              <div className="flex justify-between text-nerv-dim/50 text-[8px] font-mono tracking-widest px-0.5">
                <span>{gameStatus.opponent.score.toLocaleString()}</span>
                <span>LV {gameStatus.opponent.level}</span>
              </div>
            </div>

          </div>

          {/* ── Bottom status strip ── */}
          <div className="flex items-center gap-5 text-[8px] font-mono tracking-[0.22em] text-nerv-dim/30 select-none">
            <span>第3新東京市 // GEO-FRONT</span>
            <span>EVANGELION UNIT-01</span>
            <span className="text-bitcoin/20">LN-BATTLE PROTOCOL</span>
          </div>

        </div>
      )}

      {/* ── Result ── */}
      {gameStatus.status === 'result' && (
        <div className="flex flex-col items-center gap-6">
          <div className="text-center flex flex-col gap-1">
            <p className="text-nerv-dim text-[10px] tracking-[0.4em] font-mono">
              // OPERATION COMPLETE
            </p>
            <p className={`font-display font-bold text-5xl tracking-[0.2em] ${gameStatus.youWon ? 'text-magi' : 'text-alert'}`}>
              {gameStatus.youWon ? 'VICTORY' : 'DEFEAT'}
            </p>
            <p className="text-nerv-dim text-[10px] tracking-[0.3em] font-jp mt-1">
              {gameStatus.youWon ? '作戦成功' : '作戦失敗'}
            </p>
          </div>

          <div className="w-full max-w-xs border border-border bg-surface nerv-frame p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="text-nerv-dim text-[10px] font-mono tracking-[0.3em]">OPERATIVE</span>
              <span className="text-nerv-dim text-[10px] font-mono tracking-[0.3em]">ADVERSARY</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-bitcoin font-mono font-bold text-lg">{gameStatus.yourScore.toLocaleString()}</span>
              <span className="text-nerv-dim text-[9px] font-mono tracking-widest">SCORE</span>
              <span className="text-nerv-dim font-mono text-lg">{gameStatus.opponentScore.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={handleGoToLobby}
            className="w-full max-w-xs py-3 border border-bitcoin text-bitcoin font-display font-bold text-sm tracking-[0.2em] hover:bg-bitcoin hover:text-black transition-colors nerv-frame"
          >
            RETURN TO BASE
          </button>
        </div>
      )}
    </div>
  );
}

// ── MissionStaging ─────────────────────────────────────────────────────────────

interface MissionStagingProps {
  roomId: string;
  myIndex: 0 | 1;
  players: { index: 0 | 1; ready: boolean }[];
  onToggleReady: () => void;
  onAbort: () => void;
}

function MissionStaging({ roomId, myIndex, players, onToggleReady, onAbort }: MissionStagingProps) {
  const myPlayer = players.find(p => p.index === myIndex);
  const amReady = myPlayer?.ready ?? false;

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-sm">
      {/* Header */}
      <div className="text-center flex flex-col gap-2">
        <p className="text-nerv-dim text-xs tracking-[0.4em] font-mono">ネルフ</p>
        <p className="text-bitcoin font-display font-bold text-3xl tracking-[0.3em]">MISSION STAGING</p>
        <p className="text-nerv-dim text-xs tracking-[0.3em] font-jp mt-1">作戦準備中</p>
      </div>

      <RoomIdBadge roomId={roomId} />

      {/* Player roster */}
      <div className="w-full flex flex-col gap-3">
        <p className="text-nerv-dim/60 text-xs font-mono tracking-[0.4em]">// OPERATIVES</p>
        {([0, 1] as const).map(idx => {
          const player = players.find(p => p.index === idx);
          const isMe = idx === myIndex;
          return (
            <div key={idx} className="nerv-frame px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-nerv-dim/50 text-sm font-mono tracking-widest">UNIT-0{idx + 1}</span>
                {isMe && (
                  <span className="text-bitcoin/60 text-xs font-mono tracking-widest border-l border-border pl-3">
                    YOU
                  </span>
                )}
              </div>
              {!player ? (
                <span className="text-nerv-dim/30 text-sm font-mono tracking-widest animate-pulse">◌ AWAITING</span>
              ) : player.ready ? (
                <span className="text-magi text-sm font-mono tracking-widest font-bold">■ READY</span>
              ) : (
                <span className="text-nerv-dim/50 text-sm font-mono tracking-widest">◌ STANDBY</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Ready toggle */}
      <button
        onClick={onToggleReady}
        className={`w-full py-4 font-display font-bold text-base tracking-[0.3em] nerv-frame border transition-colors
          ${amReady
            ? 'border-magi text-magi hover:bg-magi hover:text-black'
            : 'border-bitcoin text-bitcoin hover:bg-bitcoin hover:text-black'
          }`}
      >
        {amReady ? '■ READY — CLICK TO CANCEL' : '◌ CONFIRM READY'}
      </button>

      <NervGhostBtn onClick={onAbort}>ABORT MISSION</NervGhostBtn>
    </div>
  );
}

function RoomIdBadge({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-nerv-dim text-[10px] font-mono tracking-[0.3em]">SESSION ID</span>
      <div className="flex items-center gap-3 border border-border-hi bg-surface px-4 py-2.5 nerv-frame">
        <span className="text-bitcoin font-mono text-xs tracking-wider">{roomId}</span>
        <button
          onClick={copy}
          className="text-nerv-dim hover:text-bitcoin transition-colors text-[10px] font-display tracking-widest border-l border-border pl-3"
          title="Copy room ID"
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <span className="text-nerv-dim/50 text-[9px] font-jp">共有コード — SHARE WITH OPPONENT</span>
    </div>
  );
}

function NervGhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-6 py-2.5 border border-border-hi text-nerv-dim font-display text-xs tracking-[0.2em] hover:border-alert hover:text-alert transition-colors"
    >
      {children}
    </button>
  );
}
