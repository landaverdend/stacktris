import { useEffect, useState } from 'react';
import { useGameClient } from '../hooks/useGameClient';

const API_BASE = `${window.location.protocol}//${window.location.host}`;

interface LobbyEntry {
  id: string;
  bet_sats: number;
  created_at: number;
}

interface Props {
  onEnterGame: () => void;
  onEnterSolo: () => void;
}

type MenuItem = 'battle' | 'create' | 'join';

const MENU = [
  { id: 'solo', label: 'SOLO MODE', jp: 'ソロプレイ' },
  { id: 'battle', label: 'BATTLE ARENA', jp: 'バトル' },
  { id: 'create', label: 'CREATE MATCH', jp: '作成' },
  { id: 'join', label: 'JOIN BY ID', jp: '参加' },
] as const;

export function LobbyScreen({ onEnterGame, onEnterSolo }: Props) {
  const { state, client } = useGameClient();
  const [betSats, setBetSats] = useState(1000);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [expanded, setExpanded] = useState<MenuItem | null>(null);
  const [rooms, setRooms] = useState<LobbyEntry[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (state.gameStatus.status !== 'lobby') onEnterGame();
  }, [state.gameStatus.status, onEnterGame]);

  useEffect(() => {
    if (expanded !== 'battle') return;
    const fetch_ = async () => {
      setLoadingRooms(true);
      try {
        const res = await fetch(`${API_BASE}/rooms`);
        if (res.ok) setRooms(await res.json() as LobbyEntry[]);
      } catch { /* backend not up */ }
      finally { setLoadingRooms(false); }
    };
    fetch_();
    const iv = setInterval(fetch_, 5_000);
    return () => clearInterval(iv);
  }, [expanded]);

  function handleItem(id: (typeof MENU)[number]['id']) {
    if (id === 'solo') { onEnterSolo(); return; }
    setExpanded(prev => prev === id ? null : id as MenuItem);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 px-4">

      {/* Title */}
      <div className="text-center flex flex-col gap-1">
        <p className="text-nerv-dim text-[10px] tracking-[0.4em] font-mono">ネルフ</p>
        <h1 className="font-display text-6xl font-bold text-bitcoin tracking-[0.15em]">STACKTRIS</h1>
        <p className="text-nerv-dim text-[10px] tracking-[0.35em] font-mono mt-1">
          BATTLE TETRIS // ライトニングネットワーク
        </p>
      </div>

      {/* Menu list */}
      <div className="w-full max-w-xs flex flex-col bg-surface">
        {MENU.map((item, i) => {
          const isOpen = expanded === item.id;
          return (
            <div key={item.id}>
              <button
                onClick={() => handleItem(item.id)}
                className={`w-full flex items-baseline justify-between px-0 py-3 border-b transition-colors group cursor-pointer ${isOpen
                  ? 'border-bitcoin text-bitcoin'
                  : 'border-border text-nerv-dim hover:text-bitcoin hover:border-bitcoin/50'
                  } ${i === 0 ? 'border-t' : ''}`}
              >
                <span className="font-display text-sm font-bold tracking-[0.25em]">{item.label}</span>
                <span className="font-jp text-[9px] opacity-50">{item.jp}</span>
              </button>

              {/* Expanded panel */}
              {isOpen && (
                <div className="py-4 px-1 border-b border-border flex flex-col gap-3">
                  {item.id === 'battle' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-nerv-dim tracking-[0.3em]">OPEN SESSIONS</span>
                        <span className={`text-[9px] font-mono text-bitcoin tracking-widest transition-opacity ${loadingRooms ? 'opacity-100' : 'opacity-0'}`}>◌ SYNC</span>
                      </div>
                      {rooms.length === 0 ? (
                        <div className="py-5 flex flex-col items-center gap-2">
                          <p className="text-nerv-dim font-mono text-xs tracking-widest">// NO SESSIONS FOUND</p>
                          <button
                            className="text-bitcoin text-xs tracking-widest hover:opacity-70 transition-opacity font-display"
                            onClick={() => setExpanded('create')}
                          >
                            CREATE ONE →
                          </button>
                        </div>
                      ) : (
                        rooms.map(r => (
                          <RoomRow key={r.id} room={r} onJoin={() => client.joinRoom(r.id, r.bet_sats)} />
                        ))
                      )}
                    </div>
                  )}

                  {item.id === 'create' && (
                    <>
                      <NervField label="BET AMOUNT" jp="掛け金">
                        <input
                          type="number"
                          className="w-full bg-surface-2 border border-border-hi text-bitcoin px-3 py-2.5 text-sm outline-none focus:border-bitcoin transition-colors font-mono tracking-wider"
                          value={betSats}
                          min={1}
                          onChange={e => setBetSats(Number(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-nerv-dim text-xs pointer-events-none font-mono">SATS</span>
                      </NervField>
                      <NervButton onClick={() => client.createRoom(betSats)}>INITIALIZE SESSION</NervButton>
                    </>
                  )}

                  {item.id === 'join' && (
                    <>
                      <NervField label="SESSION ID" jp="セッションID">
                        <input
                          type="text"
                          className="w-full bg-surface-2 border border-border-hi text-bitcoin px-3 py-2.5 text-sm outline-none focus:border-bitcoin transition-colors font-mono tracking-wider"
                          value={joinRoomId}
                          placeholder="XXXXXXXX-XXXX-..."
                          onChange={e => setJoinRoomId(e.target.value)}
                        />
                      </NervField>
                      <NervField label="BET AMOUNT" jp="掛け金">
                        <input
                          type="number"
                          className="w-full bg-surface-2 border border-border-hi text-bitcoin px-3 py-2.5 text-sm outline-none focus:border-bitcoin transition-colors font-mono"
                          value={betSats}
                          min={1}
                          onChange={e => setBetSats(Number(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-nerv-dim text-xs pointer-events-none font-mono">SATS</span>
                      </NervField>
                      <NervButton onClick={() => joinRoomId && client.joinRoom(joinRoomId, betSats)} disabled={!joinRoomId}>
                        CONNECT TO SESSION
                      </NervButton>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-nerv-dim text-[10px] tracking-[0.3em] font-jp">ライトニングネットワーク搭載</p>
    </div>
  );
}

function RoomRow({ room, onJoin }: { room: LobbyEntry; onJoin: () => void }) {
  const ageSeconds = Math.floor(Date.now() / 1000) - room.created_at;
  const age = ageSeconds < 60 ? `${ageSeconds}S` : `${Math.floor(ageSeconds / 60)}M`;

  return (
    <div className="flex items-center justify-between border border-border px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-nerv-dim font-mono text-[10px] tracking-widest">ID:{room.id.slice(0, 8).toUpperCase()}</span>
        <span className="text-nerv-dim/50 font-mono text-[9px]">T+{age}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-bitcoin font-mono text-sm font-bold tracking-wider">
          {room.bet_sats.toLocaleString()}
          <span className="text-nerv-dim text-[10px] font-normal ml-1">SATS</span>
        </span>
        <button
          onClick={onJoin}
          className="px-3 py-1 border border-bitcoin text-bitcoin text-[10px] font-display font-bold tracking-widest hover:bg-bitcoin hover:text-black transition-colors"
        >
          JOIN
        </button>
      </div>
    </div>
  );
}

function NervField({ label, jp, children }: { label: string; jp: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label className="font-display text-[10px] text-nerv-dim tracking-[0.3em]">{label}</label>
        <span className="font-jp text-[9px] text-nerv-dim/40">{jp}</span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

function NervButton({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 border border-bitcoin text-bitcoin font-display font-bold text-sm tracking-[0.2em] hover:bg-bitcoin hover:text-black transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
