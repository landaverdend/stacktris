import { useGameClient } from '../hooks/useGameClient';

export function NavBar() {
  const { state } = useGameClient();
  const { connection, gameStatus } = state;

  const currentRoomId = 'roomId' in gameStatus ? gameStatus.roomId : null;

  return (
    <div className="fixed top-0 inset-x-0 h-10 bg-topbar border-b border-border-dim flex items-center justify-between px-4 z-50">
      <span className="text-bitcoin font-bold tracking-widest text-sm">⚡ STACKTRIS</span>

      {currentRoomId ? (
        <button
          className="text-zinc-600 hover:text-zinc-300 font-mono text-xs px-2 py-1 border border-border rounded transition-colors"
          title="Click to copy"
          onClick={() => navigator.clipboard.writeText(currentRoomId)}
        >
          {currentRoomId}
        </button>
      ) : <span />}

      <span className={`text-xs px-2 py-0.5 rounded font-mono ${connection === 'connected' ? 'text-green-400 bg-green-950' :
          connection === 'connecting' ? 'text-yellow-400 bg-yellow-950' :
            'text-red-400 bg-red-950'
        }`}>
        {connection === 'connected' ? '● live' : connection === 'connecting' ? '◌ connecting' : '○ offline'}
      </span>
    </div>
  );
}
