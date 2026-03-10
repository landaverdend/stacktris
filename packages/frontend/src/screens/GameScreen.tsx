import { useCallback, useEffect, useRef, useState } from 'react';
import { InputAction } from '@stacktris/shared';
import { useRoom } from '../context/RoomContext';
import { BoardCanvas } from '../components/BoardCanvas';
import { QueueCanvas } from '../components/QueueCanvas';
import { HoldCanvas } from '../components/HoldCanvas';
import { GarbageMeter } from '../components/GarbageMeter';
import { PieceSnapshot } from '../types';

const DAS_MS = 150;
const ARR_MS = 33;
const EMPTY_BOARD = Array.from({ length: 20 }, () => new Array(10).fill(0));
const STUB = { board: EMPTY_BOARD, current_piece: null as PieceSnapshot | null, next_pieces: [] as string[], hold_piece: null as string | null, hold_used: false, pending_garbage: 0, score: 0, lines: 0, level: 1 };
const OPP_STUB = { board: EMPTY_BOARD, pending_garbage: 0, score: 0, lines: 0, level: 1 };

interface Props { onExitToLobby: () => void; }

export function GameScreen({ onExitToLobby }: Props) {
  const { roomStatus, send, goToLobby } = useRoom();

  const dasTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const heldKey = useRef<string | null>(null);

  const [countdownDisplay, setCountdownDisplay] = useState<number | 'GO!' | null>(null);

  useEffect(() => {
    if (roomStatus.status !== 'countdown') { setCountdownDisplay(null); return; }
    let n = roomStatus.from;
    setCountdownDisplay(n);
    const iv = setInterval(() => {
      n -= 1;
      if (n > 0) { setCountdownDisplay(n); }
      else { setCountdownDisplay('GO!'); clearInterval(iv); }
    }, 1000);
    return () => clearInterval(iv);
  }, [roomStatus.status, roomStatus.status === 'countdown' ? roomStatus.from : 0]);

  const sendAction = useCallback((action: InputAction) => {
    send({ type: 'game_action', action });
  }, [send]);

  useEffect(() => {
    if (roomStatus.status !== 'playing') return;

    const clearDasArr = () => {
      if (dasTimer.current) { clearTimeout(dasTimer.current); dasTimer.current = null; }
      if (arrTimer.current) { clearInterval(arrTimer.current); arrTimer.current = null; }
      heldKey.current = null;
    };

    const startDasArr = (action: 'move_left' | 'move_right') => {
      clearDasArr();
      heldKey.current = action;
      sendAction(action);
      dasTimer.current = setTimeout(() => {
        dasTimer.current = null;
        arrTimer.current = setInterval(() => sendAction(action), ARR_MS);
      }, DAS_MS);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); startDasArr('move_left'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); startDasArr('move_right'); }
      else if (e.key === 'ArrowUp' || e.key === 'x') { e.preventDefault(); sendAction('rotate_cw'); }
      else if (e.key === 'z') { e.preventDefault(); sendAction('rotate_ccw'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); sendAction('soft_drop'); }
      else if (e.key === ' ') { e.preventDefault(); sendAction('hard_drop'); }
      else if (e.key === 'c') { e.preventDefault(); sendAction('hold'); }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' && heldKey.current === 'move_left') ||
        (e.key === 'ArrowRight' && heldKey.current === 'move_right')) clearDasArr();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); clearDasArr(); };
  }, [roomStatus.status, sendAction]);

  const handleGoToLobby = () => { goToLobby(); onExitToLobby(); };

  const your = STUB;
  const opp = OPP_STUB;

  const isWaiting = roomStatus.status === 'waiting_opponent';
  const isCountdown = roomStatus.status === 'countdown';
  const isPlaying = roomStatus.status === 'playing';

  return (
    <div className="flex items-start justify-center min-h-screen pt-14 gap-10">

      {/* ── Arena — always mounted, same position ── */}
      <div className={`flex items-start gap-3 ${isWaiting ? 'opacity-40' : ''}`}>
        <HoldCanvas holdPiece={isPlaying ? your.hold_piece : null} dimmed={isPlaying && your.hold_used} />
        <div className="flex items-end gap-1">
          <GarbageMeter pendingGarbage={isPlaying ? your.pending_garbage : 0} />
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <BoardCanvas
                board={isPlaying ? your.board : EMPTY_BOARD}
                activePiece={isPlaying ? your.current_piece : null}
                label="OPERATIVE // あなた"
              />
              {isCountdown && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                  <p className="text-nerv-dim text-[9px] font-mono tracking-[0.4em]">// COMBAT SEQUENCE INITIATING</p>
                  <p className="text-bitcoin font-display font-bold leading-none" style={{ fontSize: '7rem' }}>
                    {countdownDisplay}
                  </p>
                  <p className="text-nerv-dim text-[8px] font-jp tracking-widest">準備完了 — MAGI SYNC COMPLETE</p>
                </div>
              )}
            </div>
            {isPlaying && (
              <div className="nerv-frame flex justify-between items-center px-2 py-1.5">
                <div className="flex flex-col gap-0">
                  <span className="text-nerv-dim/60 text-[8px] font-mono tracking-[0.3em]">SCORE</span>
                  <span className="text-bitcoin font-mono font-bold text-sm leading-none">{your.score.toLocaleString()}</span>
                </div>
                <div className="w-px h-5 bg-border" />
                <div className="flex flex-col gap-0 items-end">
                  <span className="text-nerv-dim/60 text-[8px] font-mono tracking-[0.3em]">LEVEL</span>
                  <span className="text-bitcoin font-mono font-bold text-sm leading-none">{your.level}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <QueueCanvas nextPieces={isPlaying ? your.next_pieces : []} />
      </div>

      {/* ── Right panel — MissionStaging or opponent mini board ── */}
      {isWaiting && (
        <MissionStaging
          roomId={roomStatus.roomId}
          myIndex={roomStatus.myIndex}
          players={roomStatus.players}
          onToggleReady={() => {
            const myPlayer = roomStatus.players.find(p => p.index === roomStatus.myIndex);
            send({ type: 'player_ready', ready: !(myPlayer?.ready ?? false) });
          }}
          onAbort={handleGoToLobby}
        />
      )}

      {isPlaying && (
        <div className="flex flex-col gap-1 pt-6">
          <p className="text-nerv-dim/50 text-[8px] font-mono tracking-[0.3em]">// HOSTILE UNIT</p>
          <div className="nerv-frame p-0.5">
            <BoardCanvas board={opp.board} label="ADVERSARY" scale={0.4} />
          </div>
          <div className="flex justify-between text-nerv-dim/50 text-[8px] font-mono tracking-widest px-0.5">
            <span>{opp.score.toLocaleString()}</span>
            <span>LV {opp.level}</span>
          </div>
        </div>
      )}

    </div>
  );
}

// ── MissionStaging ────────────────────────────────────────────────────────────

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
    <div className="flex flex-col items-center gap-8 w-full max-w-sm pt-2">
      <div className="text-center flex flex-col gap-2">
        <p className="text-nerv-dim text-xs tracking-[0.4em] font-mono">ネルフ</p>
        <p className="text-bitcoin font-display font-bold text-3xl tracking-[0.3em]">MISSION STAGING</p>
        <p className="text-nerv-dim text-xs tracking-[0.3em] font-jp mt-1">作戦準備中</p>
      </div>

      <RoomIdBadge roomId={roomId} />

      <div className="w-full flex flex-col gap-3">
        <p className="text-nerv-dim/60 text-xs font-mono tracking-[0.4em]">// OPERATIVES</p>
        {([0, 1] as const).map(idx => {
          const player = players.find(p => p.index === idx);
          const isMe = idx === myIndex;
          return (
            <div key={idx} className="nerv-frame px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-nerv-dim/50 text-sm font-mono tracking-widest">UNIT-0{idx + 1}</span>
                {isMe && <span className="text-bitcoin/60 text-xs font-mono tracking-widest border-l border-border pl-3">YOU</span>}
              </div>
              {!player
                ? <span className="text-nerv-dim/30 text-sm font-mono tracking-widest animate-pulse">◌ AWAITING</span>
                : player.ready
                  ? <span className="text-magi text-sm font-mono tracking-widest font-bold">■ READY</span>
                  : <span className="text-nerv-dim/50 text-sm font-mono tracking-widest">◌ STANDBY</span>
              }
            </div>
          );
        })}
      </div>

      <button
        onClick={onToggleReady}
        className={`w-full py-4 font-display font-bold text-base tracking-[0.3em] nerv-frame border transition-colors
          ${amReady ? 'border-magi text-magi hover:bg-magi hover:text-black' : 'border-bitcoin text-bitcoin hover:bg-bitcoin hover:text-black'}`}
      >
        {amReady ? '■ READY — CLICK TO CANCEL' : '◌ CONFIRM READY'}
      </button>

      <button
        onClick={onAbort}
        className="px-6 py-2.5 border border-border-hi text-nerv-dim font-display text-xs tracking-[0.2em] hover:border-alert hover:text-alert transition-colors"
      >
        ABORT MISSION
      </button>
    </div>
  );
}

function RoomIdBadge({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(roomId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-nerv-dim text-[10px] font-mono tracking-[0.3em]">SESSION ID</span>
      <div className="flex items-center gap-3 border border-border-hi bg-surface px-4 py-2.5 nerv-frame">
        <span className="text-bitcoin font-mono text-xs tracking-wider">{roomId}</span>
        <button onClick={copy} className="text-nerv-dim hover:text-bitcoin transition-colors text-[10px] font-display tracking-widest border-l border-border pl-3" title="Copy room ID">
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <span className="text-nerv-dim/50 text-[9px] font-jp">共有コード — SHARE WITH OPPONENT</span>
    </div>
  );
}
