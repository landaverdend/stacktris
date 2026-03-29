import { useRoom } from '../context/SessionContext';
import { useTranslation } from 'react-i18next';

export function NavBar() {
  const { connectionStatus, roomState } = useRoom();
  const { roomId } = roomState;
  const { t } = useTranslation();

  const statusLabel =
    connectionStatus === 'connected' ? t('navbar.online') :
      connectionStatus === 'connecting' ? t('navbar.syncing') :
        t('navbar.offline');

  return (
    <div className="fixed top-0 inset-x-0 h-10 bg-topbar border-b border-border flex items-center justify-between px-4 z-50">
      {/* Left: logo */}
      <div className="flex items-center gap-3">
        <span className="text-bitcoin font-bold tracking-[0.2em] text-base font-display">
          STACKTRIS
        </span>
        <span className="text-nerv-dim text-[10px] tracking-widest hidden sm:inline font-jp">
          システム // BTC-01
        </span>
      </div>



      {/* Right: connection */}
      <span className={`text-[10px] tracking-widest font-mono ${connectionStatus === 'connected' ? 'text-magi' :
        connectionStatus === 'connecting' ? 'text-yellow-500' :
          'text-alert'
        }`}>
        {statusLabel}
      </span>
    </div>
  );
}
