import { useGameClient } from '../hooks/useGameClient';

export function NavBar() {
  const { state } = useGameClient();
  const { connection, gameStatus } = state;

  const currentRoomId = 'roomId' in gameStatus ? gameStatus.roomId : null;

  return (
    <div className="fixed top-0 inset-x-0 h-10 bg-topbar border-b border-border flex items-center justify-between px-4 z-50">
      {/* Left: logo */}
      <div className="flex items-center gap-3">
        <span className="text-bitcoin font-bold tracking-[0.2em] text-base font-display">
          STACKTRIS
        </span>
        <span className="text-nerv-dim text-[10px] tracking-widest hidden sm:inline font-jp">
          システム // MAGI-01
        </span>
      </div>

      {/* Center: room ID */}
      {currentRoomId ? (
        <button
          className="text-nerv-dim hover:text-bitcoin font-mono text-[10px] px-2 py-0.5 border border-border rounded tracking-widest transition-colors"
          title="Click to copy room ID"
          onClick={() => navigator.clipboard.writeText(currentRoomId)}
        >
          RM:{currentRoomId.slice(0, 8).toUpperCase()}
        </button>
      ) : <span />}

      {/* Right: connection */}
      <span className={`text-[10px] tracking-widest font-mono ${
        connection === 'connected'  ? 'text-magi' :
        connection === 'connecting' ? 'text-yellow-500' :
                                      'text-alert'
      }`}>
        {connection === 'connected'  ? '● ONLINE' :
         connection === 'connecting' ? '◌ SYNC...' :
                                       '○ OFFLINE'}
      </span>
    </div>
  );
}
