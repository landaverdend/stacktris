import { useWebSocket } from '../hooks/useWebSocket';

export function NavBar() {
  const { status: connection } = useWebSocket();


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

      {/* Center: room ID — TODO: wire up once game state layer is rebuilt */}
      <span />

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
