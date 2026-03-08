import { useEffect, useRef } from 'react';
import { useGameClient } from '../hooks/useGameClient';
import { BoardCanvas } from '../components/BoardCanvas';
import { QueueCanvas } from '../components/QueueCanvas';
import { HoldCanvas } from '../components/HoldCanvas';

// Delayed Auto Shift: how long (ms) to hold a key before auto-repeat begins.
const DAS_MS = 150;
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
      {gameStatus.status === 'waiting_payment' && (
        <>
          <p className="text-zinc-400 text-sm">Waiting for payment confirmation...</p>
          <GhostBtn onClick={handleGoToLobby}>Cancel</GhostBtn>
        </>
      )}

      {gameStatus.status === 'waiting_opponent' && (
        <>
          <p className="text-bitcoin text-lg font-bold">⚡ Paid</p>
          <p className="text-zinc-500 text-sm">Waiting for opponent to join...</p>
          <GhostBtn onClick={handleGoToLobby}>Cancel</GhostBtn>
        </>
      )}

      {gameStatus.status === 'playing' && (
        <div className="relative flex items-start justify-center w-full pt-4">
          {/* Your board + hold (left) + queue (right) */}
          <div className="flex items-start gap-3">
            <HoldCanvas
              holdPiece={gameStatus.your.hold_piece}
              dimmed={gameStatus.your.hold_used}
            />
            <div className="flex flex-col gap-2">
              <BoardCanvas
                board={gameStatus.your.board}
                activePiece={gameStatus.your.current_piece}
                label="You"
              />
              <div className="flex justify-between text-zinc-600 text-xs font-mono px-1">
                <span>{gameStatus.your.score.toLocaleString()} pts</span>
                <span>Lv {gameStatus.your.level}</span>
              </div>
            </div>
            <QueueCanvas nextPieces={gameStatus.your.next_pieces} />
          </div>

          {/* Opponent board — small, top-right */}
          <div className="absolute top-0 right-6 flex flex-col gap-1">
            <BoardCanvas
              board={gameStatus.opponent.board}
              label="Opponent"
              scale={0.4}
            />
            <div className="flex justify-between text-zinc-700 text-xs font-mono px-0.5">
              <span>{gameStatus.opponent.score.toLocaleString()}</span>
              <span>Lv {gameStatus.opponent.level}</span>
            </div>
          </div>
        </div>
      )}

      {gameStatus.status === 'result' && (
        <>
          <p className="text-4xl">{gameStatus.winnerId === 'you' ? '🏆' : '💀'}</p>
          <p className="text-bitcoin text-2xl font-bold">
            {gameStatus.winnerId === 'you' ? 'You Win' : 'You Lose'}
          </p>
          <p className="text-zinc-600 text-sm">
            You: {gameStatus.yourScore.toLocaleString()} pts · Opponent: {gameStatus.opponentScore.toLocaleString()} pts
          </p>
          <OrangeBtn onClick={handleGoToLobby}>Play Again</OrangeBtn>
        </>
      )}
    </div>
  );
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 px-5 py-2 text-sm text-zinc-500 border border-border-hi rounded hover:text-zinc-300 hover:border-zinc-500 transition-colors"
    >
      {children}
    </button>
  );
}

function OrangeBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 px-8 py-3 bg-bitcoin text-black font-bold rounded hover:opacity-90 transition-opacity"
    >
      {children}
    </button>
  );
}
