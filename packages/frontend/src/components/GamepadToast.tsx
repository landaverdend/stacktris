import { useEffect, useState } from 'react';

interface Toast {
  id: number;
  connected: boolean;
  name: string;
}

function friendlyName(id: string): string {
  // Strip the "(STANDARD GAMEPAD Vendor: xxxx Product: xxxx)" suffix Chrome appends
  return id.replace(/\s*\(STANDARD GAMEPAD[^)]*\)/i, '').trim() || id;
}

let _counter = 0;

export function GamepadToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const add = (e: GamepadEvent, connected: boolean) => {
      const id = ++_counter;
      setToasts(prev => [...prev, { id, connected, name: friendlyName(e.gamepad.id) }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    };

    const onConnect = (e: GamepadEvent) => add(e, true);
    const onDisconnect = (e: GamepadEvent) => add(e, false);

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="nerv-border bg-black px-4 py-3 flex flex-col gap-0.5">
          <span className={`font-mono text-[10px] tracking-widest ${toast.connected ? 'text-teal' : 'text-alert'}`}>
            {toast.connected ? '◉ CONTROLLER CONNECTED' : '○ CONTROLLER DISCONNECTED'}
          </span>
          <span className="font-display font-bold text-xl tracking-[0.02em] text-phosphor">
            {toast.name}
          </span>
        </div>
      ))}
    </div>
  );
}
