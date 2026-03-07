import { useEffect, useState } from 'react';
import { useGameClient } from '../hooks/useGameClient';

interface Props {
  onEnterGame: () => void;
}

export function LobbyScreen({ onEnterGame }: Props) {
  const { state, client } = useGameClient();
  const [betSats, setBetSats] = useState(1000);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');

  useEffect(() => {
    if (state.gameStatus.status !== 'lobby') {
      onEnterGame();
    }
  }, [state.gameStatus.status, onEnterGame]);

  const tabs = [
    { id: 'create', label: 'Create' },
    { id: 'join', label: 'Join' },
  ] as const;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 pt-10 px-4">

      <div className="text-center">
        <h1 className="text-5xl font-bold text-bitcoin tracking-widest mb-1">STACKTRIS</h1>
        <p className="text-zinc-600 text-sm tracking-widest">BATTLE TETRIS · LIGHTNING NETWORK</p>
      </div>

      <div className="w-full max-w-sm bg-surface border border-border rounded-xl overflow-hidden">

        <div className="flex border-b border-border">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-sm font-bold tracking-wider transition-colors ${tab === t.id
                  ? 'text-bitcoin border-b-2 border-bitcoin bg-surface-2'
                  : 'text-zinc-600 hover:text-zinc-400'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 flex flex-col gap-4">

          {tab === 'create' && (
            <>
              <Field label="Bet Amount">
                <input
                  type="number"
                  className="w-full bg-surface-2 border border-border-hi text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-bitcoin transition-colors"
                  value={betSats}
                  min={1}
                  onChange={e => setBetSats(Number(e.target.value))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs pointer-events-none">sats</span>
              </Field>
              <button
                className="w-full py-3 bg-bitcoin text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
                onClick={() => client.createRoom(betSats)}
              >
                Create Room
              </button>
            </>
          )}

          {tab === 'join' && (
            <>
              <Field label="Room ID">
                <input
                  type="text"
                  className="w-full bg-surface-2 border border-border-hi text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-bitcoin transition-colors font-mono tracking-wider"
                  value={joinRoomId}
                  placeholder="xxxxxxxx-xxxx-xxxx-..."
                  onChange={e => setJoinRoomId(e.target.value)}
                />
              </Field>
              <Field label="Bet Amount">
                <input
                  type="number"
                  className="w-full bg-surface-2 border border-border-hi text-zinc-100 px-3 py-2.5 rounded-lg text-sm outline-none focus:border-bitcoin transition-colors"
                  value={betSats}
                  min={1}
                  onChange={e => setBetSats(Number(e.target.value))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs pointer-events-none">sats</span>
              </Field>
              <button
                className="w-full py-3 bg-bitcoin text-black font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                onClick={() => joinRoomId && client.joinRoom(joinRoomId, betSats)}
                disabled={!joinRoomId}
              >
                Join Room
              </button>
            </>
          )}

        </div>
      </div>

      <p className="text-zinc-800 text-xs">⚡ powered by lightning</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-zinc-500 text-xs tracking-widest uppercase">{label}</label>
      <div className="relative">{children}</div>
    </div>
  );
}
