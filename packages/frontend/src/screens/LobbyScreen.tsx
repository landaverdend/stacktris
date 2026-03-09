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
}

export function LobbyScreen({ onEnterGame }: Props) {
  const { state, client } = useGameClient();
  const [betSats, setBetSats] = useState(1000);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [tab, setTab] = useState<'browse' | 'create' | 'join'>('browse');
  const [rooms, setRooms] = useState<LobbyEntry[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    if (state.gameStatus.status !== 'lobby') {
      onEnterGame();
    }
  }, [state.gameStatus.status, onEnterGame]);

  useEffect(() => {
    if (tab !== 'browse') return;

    const fetchRooms = async () => {
      setLoadingRooms(true);
      try {
        const res = await fetch(`${API_BASE}/rooms`);
        if (res.ok) setRooms(await res.json() as LobbyEntry[]);
      } catch {
        // backend not up
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
    const iv = setInterval(fetchRooms, 5_000);
    return () => clearInterval(iv);
  }, [tab]);

  const tabs = [
    { id: 'browse', label: 'BROWSE', jp: 'ブラウズ' },
    { id: 'create', label: 'CREATE', jp: '作成' },
    { id: 'join', label: 'JOIN ID', jp: '参加' },
  ] as const;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 pt-10 px-4">

      {/* ── Title block ── */}
      <div className="text-center flex flex-col gap-1">
        <p className="text-nerv-dim text-[10px] tracking-[0.4em] font-mono">
          ネルフ
        </p>
        <h1 className="font-display text-6xl font-bold text-bitcoin tracking-[0.15em]">
          STACKTRIS
        </h1>
        <p className="text-nerv-dim text-[10px] tracking-[0.35em] font-mono mt-1">
          BATTLE TETRIS // ライトニングネットワーク
        </p>
      </div>

      {/* ── Main panel ── */}
      <div className="w-full max-w-sm border border-border-hi bg-surface nerv-frame">

        {/* Tab bar */}
        <div className="flex border-b border-border">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 transition-colors ${tab === t.id
                  ? 'text-bitcoin border-b-2 border-bitcoin bg-nerv-faint'
                  : 'text-nerv-dim hover:text-bitcoin/70'
                }`}
            >
              <span className="font-display text-xs font-bold tracking-widest">{t.label}</span>
              <span className="font-jp text-[9px] opacity-50">{t.jp}</span>
            </button>
          ))}
        </div>

        <div className="p-5 flex flex-col gap-4">

          {/* ── Browse ── */}
          {tab === 'browse' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-display text-[10px] text-nerv-dim tracking-[0.3em]">
                  OPEN SESSIONS
                </span>
                <span className={`text-[9px] font-mono tracking-widest transition-opacity ${loadingRooms ? 'text-bitcoin opacity-100' : 'opacity-0'}`}>
                  ◌ SYNC
                </span>
              </div>

              {rooms.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 nerv-hazard">
                  <p className="text-nerv-dim font-mono text-xs tracking-widest">// NO SESSIONS FOUND</p>
                  <button
                    className="text-bitcoin text-xs tracking-widest hover:opacity-70 transition-opacity font-display"
                    onClick={() => setTab('create')}
                  >
                    INITIALIZE NEW SESSION →
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {rooms.map(r => (
                    <RoomRow key={r.id} room={r} onJoin={() => client.joinRoom(r.id, r.bet_sats)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Create ── */}
          {tab === 'create' && (
            <>
              <NervField label="BET AMOUNT" jp="掛け金">
                <input
                  type="number"
                  className="w-full bg-surface-2 border border-border-hi text-bitcoin px-3 py-2.5 rounded-none text-sm outline-none focus:border-bitcoin transition-colors font-mono tracking-wider"
                  value={betSats}
                  min={1}
                  onChange={e => setBetSats(Number(e.target.value))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-nerv-dim text-xs pointer-events-none font-mono">
                  SATS
                </span>
              </NervField>
              <NervButton onClick={() => client.createRoom(betSats)}>
                INITIALIZE SESSION
              </NervButton>
            </>
          )}

          {/* ── Join by ID ── */}
          {tab === 'join' && (
            <>
              <NervField label="SESSION ID" jp="セッションID">
                <input
                  type="text"
                  className="w-full bg-surface-2 border border-border-hi text-bitcoin px-3 py-2.5 rounded-none text-sm outline-none focus:border-bitcoin transition-colors font-mono tracking-wider"
                  value={joinRoomId}
                  placeholder="XXXXXXXX-XXXX-XXXX-..."
                  onChange={e => setJoinRoomId(e.target.value)}
                />
              </NervField>
              <NervField label="BET AMOUNT" jp="掛け金">
                <input
                  type="number"
                  className="w-full bg-surface-2 border border-border-hi text-bitcoin px-3 py-2.5 rounded-none text-sm outline-none focus:border-bitcoin transition-colors font-mono"
                  value={betSats}
                  min={1}
                  onChange={e => setBetSats(Number(e.target.value))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-nerv-dim text-xs pointer-events-none font-mono">
                  SATS
                </span>
              </NervField>
              <NervButton
                onClick={() => joinRoomId && client.joinRoom(joinRoomId, betSats)}
                disabled={!joinRoomId}
              >
                CONNECT TO SESSION
              </NervButton>
            </>
          )}

        </div>
      </div>

      <p className="text-nerv-dim text-[10px] tracking-[0.3em] font-jp">
        ⚡ ライトニングネットワーク搭載
      </p>
    </div>
  );
}

function RoomRow({ room, onJoin }: { room: LobbyEntry; onJoin: () => void }) {
  const ageSeconds = Math.floor(Date.now() / 1000) - room.created_at;
  const age = ageSeconds < 60
    ? `${ageSeconds}S`
    : `${Math.floor(ageSeconds / 60)}M`;

  return (
    <div className="flex items-center justify-between border border-border bg-surface-2 px-3 py-2 nerv-frame">
      <div className="flex flex-col gap-0.5">
        <span className="text-nerv-dim font-mono text-[10px] tracking-widest">
          ID:{room.id.slice(0, 8).toUpperCase()}
        </span>
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
      className="w-full py-3 border border-bitcoin text-bitcoin font-display font-bold text-sm tracking-[0.2em] hover:bg-bitcoin hover:text-black transition-colors disabled:opacity-20 disabled:cursor-not-allowed nerv-frame"
    >
      {children}
    </button>
  );
}
