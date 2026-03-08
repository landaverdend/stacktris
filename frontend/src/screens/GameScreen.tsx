import { useGameClient } from '../hooks/useGameClient';
import { BoardCanvas } from '../components/BoardCanvas';
import { QueueCanvas } from '../components/QueueCanvas';

interface Props {
  onExitToLobby: () => void;
}

export function GameScreen({ onExitToLobby }: Props) {
  const { state, client } = useGameClient();
  const { gameStatus } = state;

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
          {/* Your board + queue */}
          <div className="flex items-start gap-3">
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
