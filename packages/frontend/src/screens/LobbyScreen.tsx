import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { RoomInfo } from '@stacktris/shared';
import { cn } from '../lib/utils';
import { GenesisBlock } from '../components/GenesisBlock';
import { GlitchTitle } from '../components/GlitchTitle';
import { GlitchOverlay } from '../components/GlitchOverlay';
import { LightningGraph } from '../components/LightningGraph';
import { NervModal } from '../components/NervModal';

const API_BASE = `${window.location.protocol}//${window.location.host}`;

type MenuItem = 'battle' | 'create' | 'join' | 'controls';

const MENU = [
  { id: 'solo', label: 'SOLO MODE', jp: 'ソロプレイ' },
  { id: 'battle', label: 'MULTIPLAYER', jp: 'バトル' },
  { id: 'create', label: 'CREATE MATCH', jp: '作成' },
  { id: 'join', label: 'JOIN ROOM', jp: '参加' },
  { id: 'controls', label: 'CONTROLS', jp: '操作方法' },
] as const;

const MODAL_ITEMS = new Set<string>(['battle', 'create', 'join', 'controls']);

export function LobbyScreen() {
  const navigate = useNavigate();
  const { createRoom, joinRoom } = useRoom();

  const [betSats, setBetSats] = useState(1000);
  const [joinRoomId, setJoinRoomId] = useState('');

  const [modal, setModal] = useState<MenuItem | null>(null);

  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (modal !== 'battle') return;
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
  }, [modal]);

  function handleItem(id: (typeof MENU)[number]['id']) {
    if (id === 'solo') {
      navigate('/solo');
      return;
    }
    if (MODAL_ITEMS.has(id)) {
      setModal(id as MenuItem);
    }
  }

  function handleJoinRoom(roomId: string) {
    if (roomId) {
      joinRoom(roomId);
      navigate(`/room/${roomId}`);
    } else {
      alert('Please enter a room ID');
    }
  }

  const activeItem = modal ? MENU.find((m) => m.id === modal) : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 px-4">
      <LightningGraph />
      <GlitchOverlay />
      <GenesisBlock />

      <div className="text-center flex  relative z-[3]">
        <div className="nerv-title-box bg-black">
          <div className="flex flex-col">
            <GlitchTitle />
            <div className="bg-bitcoin" style={{ height: '4px', boxShadow: '0 0 6px rgba(247,147,26,0.9), 0 0 18px rgba(247,147,26,0.5)' }} />
          </div>
          <p className="nerv-sub-text text-phosphor font-display text-[22px] tracking-[0.05em] mt-1">
            BATTLE TETRIS // ライトニングネットワーク
          </p>
        </div>
      </div>

      {/* Menu list */}
      <div className="w-full max-w-sm flex flex-col relative items-center gap-3 z-3">
        {MENU.map((item) => (
          <div key={item.id} className="bg-black w-fit flex flex-col">
            <button
              onClick={() => handleItem(item.id)}
              className={cn(
                'w-[12em] flex flex-col items-center justify-between nerv-border nerv-border-teal transition-colors cursor-pointer hover:opacity-70 '
              )}>
              <span className="font-display font-bold text-3xl tracking-[0.03em] text-phosphor">
                {item.label}
              </span>
              <span className="font-jp text-[15px] opacity-30 text-magi tracking-[0.03em] font-bold">{item.jp}</span>
            </button>
          </div>
        ))}
      </div>

      <p className="text-teal text-[20px] font-bold tracking-[0.03em] font-jp relative z-3">ライトニングネットワーク搭載</p>

      {/* Modal */}
      <NervModal
        open={modal !== null}
        title={activeItem?.label ?? ''}
        titleJp={activeItem?.jp ?? ''}
        onClose={() => setModal(null)}
      >
        {modal === 'battle' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <span className="font-display text-[10px] text-nerv-dim tracking-[0.03em]">OPEN SESSIONS</span>
              <span className={`text-[9px] font-mono text-bitcoin tracking-widest transition-opacity ${loadingRooms ? 'opacity-100' : 'opacity-0'}`}>
                ◌ SYNC
              </span>
            </div>
            {rooms.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <p className="text-nerv-dim font-mono text-xs tracking-widest">// NO SESSIONS FOUND</p>
                <button
                  className="text-bitcoin text-xs tracking-widest hover:opacity-70 transition-opacity font-display cursor-pointer"
                  onClick={() => setModal('create')}>
                  CREATE ONE →
                </button>
              </div>
            ) : (
              rooms.map((r) => <RoomRow key={r.roomId} room={r} onJoin={() => handleJoinRoom(r.roomId)} />)
            )}
          </div>
        )}

        {modal === 'create' && (
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
            <div className="mt-3">
              <NervButton onClick={() => createRoom(betSats)}>INITIALIZE SESSION</NervButton>
            </div>
          </>
        )}

        {modal === 'join' && (
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
            <div className="mt-3">
              <NervButton onClick={() => handleJoinRoom(joinRoomId)} disabled={!joinRoomId}>
                CONNECT TO SESSION
              </NervButton>
            </div>
          </>
        )}

        {modal === 'controls' && (
          <div className="flex flex-col gap-1">
            {[
              { keys: ['←', '→'], action: 'MOVE', jp: '移動' },
              { keys: ['↓'], action: 'SOFT DROP', jp: 'ソフトドロップ' },
              { keys: ['↑', 'X'], action: 'ROTATE CW', jp: '時計回り' },
              { keys: ['Z'], action: 'ROTATE CCW', jp: '反時計回り' },
              { keys: ['SPACE'], action: 'HARD DROP', jp: 'ハードドロップ' },
              { keys: ['C'], action: 'HOLD', jp: 'ホールド' },
            ].map(({ keys, action, jp }) => (
              <div key={action} className="flex items-center justify-between py-2.5 border-b border-[rgba(0,255,180,0.08)] last:border-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-sm tracking-widest text-[#c8a882]">{action}</span>
                  <span className="font-jp text-[10px] text-[rgba(0,255,180,0.3)]">{jp}</span>
                </div>
                <div className="flex gap-1.5">
                  {keys.map((k) => (
                    <kbd key={k} className="px-2 py-0.5 border border-[rgba(0,255,180,0.35)] bg-[rgba(0,255,180,0.04)] font-mono text-[11px] text-[rgba(0,255,180,0.7)] tracking-widest">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </NervModal>
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
    <div className="flex flex-col gap-1.5 mb-3">
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
