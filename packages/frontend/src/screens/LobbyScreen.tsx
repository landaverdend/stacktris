import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { RoomInfo } from '@stacktris/shared';
import { cn } from '../lib/utils';
import { GenesisBlock } from '../components/GenesisBlock';
import { GlitchOverlay } from '../components/GlitchOverlay';
import { LightningGraph } from '../components/LightningGraph';

const API_BASE = `${window.location.protocol}//${window.location.host}`;

type MenuItem = 'battle' | 'create' | 'join';

const MENU = [
  { id: 'solo', label: 'SOLO MODE', jp: 'ソロプレイ' },
  { id: 'battle', label: 'MULTIPLAYER', jp: 'バトル' },
  { id: 'create', label: 'CREATE MATCH', jp: '作成' },
  { id: 'join', label: 'JOIN ROOM', jp: '参加' },
] as const;

export function LobbyScreen() {
  const navigate = useNavigate();
  const { createRoom, joinRoom } = useRoom();

  const [betSats, setBetSats] = useState(1000);
  const [joinRoomId, setJoinRoomId] = useState('');

  const [expanded, setExpanded] = useState<MenuItem | null>(null);

  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (expanded !== 'battle') return;
    const fetch_ = async () => {
      setLoadingRooms(true);
      try {
        const res = await fetch(`${API_BASE}/rooms`);
        if (res.ok) setRooms((await res.json()) as RoomInfo[]);
      } catch {
        /* backend not up */
      } finally {
        setLoadingRooms(false);
      }
    };
    fetch_();
    const iv = setInterval(fetch_, 5_000);
    return () => clearInterval(iv);
  }, [expanded]);

  function handleItem(id: (typeof MENU)[number]['id']) {
    if (id === 'solo') {
      navigate('/solo');
      return;
    }

    setExpanded((prev) => (prev === id ? null : (id as MenuItem)));
  }

  function handleJoinRoom(roomId: string) {
    if (roomId) {
      joinRoom(roomId);
      navigate(`/room/${roomId}`);
    } else {
      alert('Please enter a room ID');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 px-4">
      <LightningGraph />
      <GlitchOverlay />
      <GenesisBlock />

      <div className="text-center flex flex-col gap-3 relative z-[3]">
        <div className="nerv-title-box bg-black">
          <h1 className="nerv-title-text font-display font-bold text-bitcoin tracking-[0.03em]">STACKTRIS</h1>
          <p className="nerv-sub-text text-bitcoin font-display text-[22px] tracking-[0.05em] mt-1">
            BATTLE TETRIS // ライトニングネットワーク
          </p>
        </div>
      </div>

      {/* Menu list */}
      <div className="w-full max-w-sm flex flex-col relative items-center ">
        {MENU.map((item, i) => {
          const isOpen = expanded === item.id;
          return (
            <div key={item.id} className="bg-black w-fit flex flex-col gap-2">
              <button
                onClick={() => handleItem(item.id)}
                className={cn(
                  'w-[12em] flex flex-col items-center justify-between border-[4px] border-magi rounded-md transition-colors cursor-pointer px-4 py-4 border'
                )}>
                <span
                  className={`font-display font-bold tracking-[0.03em] ${isOpen ? 'nerv-menu-label-active' : 'nerv-menu-label'}`}>
                  {item.label}
                </span>
                <span className="font-jp text-[15px] opacity-30 text-magi tracking-[0.03em] font-bold">{item.jp}</span>
              </button>

              {/* Expanded panel */}
              {isOpen && (
                <div className="py-4 px-1 border-b border-border flex flex-col gap-3">
                  {item.id === 'battle' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-[10px] text-nerv-dim tracking-[0.03em]">OPEN SESSIONS</span>
                        <span
                          className={`text-[9px] font-mono text-bitcoin tracking-widest transition-opacity ${loadingRooms ? 'opacity-100' : 'opacity-0'}`}>
                          ◌ SYNC
                        </span>
                      </div>
                      {rooms.length === 0 ? (
                        <div className="py-5 flex flex-col items-center gap-2">
                          <p className="text-nerv-dim font-mono text-xs tracking-widest">// NO SESSIONS FOUND</p>
                          <button
                            className="text-bitcoin text-xs tracking-widest hover:opacity-70 transition-opacity font-display cursor-pointer"
                            onClick={() => setExpanded('create')}>
                            CREATE ONE →
                          </button>
                        </div>
                      ) : (
                        rooms.map((r) => <RoomRow key={r.roomId} room={r} onJoin={() => handleJoinRoom(r.roomId)} />)
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
                          min={5}
                          onChange={(e) => setBetSats(Number(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-nerv-dim text-xs pointer-events-none font-mono">
                          SATS
                        </span>
                      </NervField>
                      <NervButton onClick={() => createRoom(betSats)}>INITIALIZE SESSION</NervButton>
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
                          onChange={(e) => setJoinRoomId(e.target.value)}
                        />
                      </NervField>
                      <NervField label="BET AMOUNT" jp="掛け金">
                        <input
                          type="number"
                          className="w-full bg-surface-2 border border-border-hi text-bitcoin px-3 py-2.5 text-sm outline-none focus:border-bitcoin transition-colors font-mono"
                          value={betSats}
                          min={1}
                          onChange={(e) => setBetSats(Number(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-nerv-dim text-xs pointer-events-none font-mono">
                          SATS
                        </span>
                      </NervField>
                      <NervButton onClick={() => handleJoinRoom(joinRoomId)} disabled={!joinRoomId}>
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

function RoomRow({ room, onJoin }: { room: RoomInfo; onJoin: () => void }) {
  const age = Math.floor(Date.now()) - room.createdAt;

  return (
    <div className="flex items-center justify-between border border-border px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-nerv-dim font-mono text-[10px] tracking-widest">ID:{room.roomId.slice(0, 8).toUpperCase()}</span>
        <span className="text-nerv-dim/50 font-mono text-[9px]">T+{age}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-bitcoin font-mono text-sm font-bold tracking-wider">
          {room.betSats.toLocaleString()}
          <span className="text-nerv-dim text-[10px] font-normal ml-1">SATS</span>
        </span>
        <button
          onClick={onJoin}
          className="px-3 py-1 border border-bitcoin text-bitcoin text-[10px] font-display font-bold tracking-widest hover:bg-bitcoin hover:text-black transition-colors cursor-pointer">
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
      className="w-full py-3 border border-bitcoin text-bitcoin font-display font-bold text-sm tracking-[0.2em] hover:bg-bitcoin hover:text-black transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer">
      {children}
    </button>
  );
}
