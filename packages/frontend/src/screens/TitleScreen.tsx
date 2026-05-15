import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useRoom } from '../context/SessionContext';
import { useConnection } from '../ws/WSContext';
import { RoomInfo } from '@stacktris/shared';
import { cn } from '../lib/utils';
import { GenesisBlock } from '../components/GenesisBlock';
import { GlitchTitle } from '../components/GlitchTitle';
import { GlitchOverlay } from '../components/GlitchOverlay';
import { Divider } from '../components/Divider';
import { LightningGraph } from '../components/LightningGraph';
import { NervModal } from '../components/NervModal';
import { NervButton } from '../components/NervButton';
import { ControlsModal } from '../components/ControlsModal';
import { OptionsModal } from '../components/OptionsModal';
import { useTranslation } from 'react-i18next';

const API_BASE = `${window.location.protocol}//${window.location.host}`;

const MENU = [
  { id: 'solo', key: 'menu.solo', jp: 'ソロプレイ' },
  { id: 'split', key: 'menu.split', jp: '分割画面' },
  { id: 'battle', key: 'menu.multiplayer', jp: 'バトル' },
  { id: 'join', key: 'menu.join', jp: '参加' },
  { id: 'controls', key: 'menu.controls', jp: '操作方法' },
  { id: 'options', key: 'menu.options', jp: '設定' },
] as const;

function BetaDisclaimer() {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleClick() {
    setRect(btnRef.current?.getBoundingClientRect() ?? null);
    setOpen(v => !v);
  }

  return (
    <div className="absolute bottom-0 right-0 translate-x-full pl-1">
      <button
        ref={btnRef}
        onClick={handleClick}
        className="font-mono text-[15px] text-[rgba(255,180,0,0.55)] tracking-wider hover:text-[rgba(255,180,0,0.85)] transition-colors cursor-pointer">
        ⚠ BETA
      </button>
      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="absolute z-[9999] w-64 bg-black border border-[rgba(255,180,0,0.3)] p-3"
            style={{ top: rect.bottom + window.scrollY + 6, left: rect.right + window.scrollX - 256 }}>
            <p className="font-mono text-[13px] text-[rgba(255,180,0,0.7)] leading-relaxed">
              This app is under active development. Any funds lost due to bugs are not the developer's responsibility. Use at your own risk.
            </p>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

export function TitleScreen() {
  const navigate = useNavigate();
  const { createRoom, joinRoom } = useRoom();
  const { setPlayerInfo } = useConnection();
  const { t } = useTranslation();

  const [modal, setModal] = useState<'battle' | 'create' | 'join' | 'controls' | 'options' | null>(null);
  const close = () => setModal(null);

  function handleItem(id: (typeof MENU)[number]['id']) {
    if (id === 'solo') { navigate('/solo'); return; }
    if (id === 'split') { navigate('/split'); return; }
    setModal(id as typeof modal);
  }

  function handleJoinRoom(roomId: string) {
    if (roomId) { joinRoom(roomId); navigate(`/room/${roomId}`); }
    else alert(t('alerts.enter_room_id'));
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 px-4">
      <LightningGraph />
      <GlitchOverlay />
      <GenesisBlock />

      <div className="text-center flex relative z-3">
        <div className="nerv-title-box bg-black">
          <div className="flex flex-col">
            <GlitchTitle />
            <Divider color="bitcoin" />
          </div>
          <p className="nerv-sub-text text-phosphor font-display text-[22px] tracking-[0.05em] mt-1">
            BATTLE TETRIS // ライトニングネットワーク
          </p>
        </div>
        <BetaDisclaimer />
      </div>

      <div className="w-full max-w-sm flex flex-col relative items-center gap-3 z-3">
        {MENU.map((item) => (
          <div key={item.id} className="bg-black w-fit flex flex-col">
            <button
              onClick={() => handleItem(item.id)}
              className={cn('w-[12em] flex flex-col items-center justify-between nerv-border nerv-border-teal transition-colors cursor-pointer hover:opacity-70')}>
              <span className="font-display font-bold text-3xl tracking-[0.03em] text-phosphor">{t(item.key)}</span>
              <span className="font-jp text-[15px] opacity-30 text-magi tracking-[0.03em] font-bold">{item.jp}</span>
            </button>
          </div>
        ))}
      </div>

      <p className="text-teal text-[20px] font-bold tracking-[0.03em] font-jp relative z-3">ライトニングネットワーク搭載</p>

      <MultiplayerModal open={modal === 'battle'} onClose={close} onCreateInstead={() => setModal('create')} onJoin={handleJoinRoom} />
      <CreateMatchModal open={modal === 'create'} onClose={close} onCreate={createRoom} />
      <JoinRoomModal open={modal === 'join'} onClose={close} onJoin={handleJoinRoom} />
      <ControlsModal open={modal === 'controls'} onClose={close} />
      <OptionsModal open={modal === 'options'} onClose={close} onSave={setPlayerInfo} />
    </div>
  );
}

// ── Sub-modals ────────────────────────────────────────────────────────────────

function SplitSetupModal({ open, onClose, onStart }: {
  open: boolean; onClose: () => void;
  onStart: (buyIn: number) => void;
}) {
  const [buyIn, setBuyIn] = useState(0);

  return (
    <NervModal open={open} title="SPLIT SCREEN" titleJp="分割画面" onClose={onClose}>
      <div className="flex flex-col">
        <div className="flex items-center justify-between py-2.5 border-b border-[rgba(0,255,180,0.08)]">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor">BUY IN</span>
            <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">掛け金</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="w-32 bg-transparent border-b border-[rgba(255,150,0,0.5)] text-bitcoin font-display font-bold text-3xl tracking-[0.02em] text-right outline-none pb-0.5"
              value={buyIn} min={0}
              onChange={(e) => setBuyIn(Math.max(0, Number(e.target.value)))}
            />
            <span className="font-jp text-[15px] text-[rgba(255,150,0,0.4)]">sats</span>
          </div>
        </div>
        <div className="pt-5">
          <NervButton onClick={() => onStart(buyIn)}>START SESSION</NervButton>
        </div>
      </div>
    </NervModal>
  );
}

function MultiplayerModal({ open, onClose, onCreateInstead, onJoin }: {
  open: boolean; onClose: () => void;
  onCreateInstead: () => void;
  onJoin: (id: string) => void;
}) {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const fetch_ = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/rooms`);
        if (res.ok) setRooms((await res.json()) as RoomInfo[]);
      } catch { /* backend not up */ }
      finally { setLoading(false); }
    };
    fetch_();
    const iv = setInterval(fetch_, 5_000);
    return () => clearInterval(iv);
  }, [open]);

  return (
    <NervModal open={open} title={t('menu.multiplayer')} titleJp="バトル" onClose={onClose}>
      <div className="flex flex-col">
        <div className="flex items-center justify-between py-2.5 border-b border-[rgba(0,255,180,0.08)]">
          <span className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor">{t('modal.open_sessions')}</span>
          <span className={`font-mono text-[11px] text-[rgba(0,255,180,0.5)] transition-opacity ${loading ? 'opacity-100' : 'opacity-0'}`}>◌ SYNC</span>
        </div>
        {rooms.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <p className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">セッションなし</p>
            <button className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor hover:opacity-60 transition-opacity cursor-pointer" onClick={onCreateInstead}>
              {t('modal.create_one')}
            </button>
          </div>
        ) : (
          rooms.map((r) => <RoomRow key={r.roomId} room={r} onJoin={() => onJoin(r.roomId)} />)
        )}
      </div>
    </NervModal>
  );
}

function CreateMatchModal({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void;
  onCreate: (sats: number) => void;
}) {
  const [buyIn, setBuyIn] = useState(0);
  const { t } = useTranslation();

  return (
    <NervModal open={open} title={t('menu.create')} titleJp="作成" onClose={onClose}>
      <div className="flex flex-col">
        <div className="flex items-center justify-between py-2.5 border-b border-[rgba(0,255,180,0.08)]">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor">{t('modal.buy_in')}</span>
            <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">掛け金</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="w-32 bg-transparent border-b border-[rgba(255,150,0,0.5)] text-bitcoin font-display font-bold text-3xl tracking-[0.02em] text-right outline-none pb-0.5"
              value={buyIn} min={0}
              onChange={(e) => setBuyIn(Number(e.target.value))}
            />
            <span className="font-jp text-[15px] text-[rgba(255,150,0,0.4)]">sats</span>
          </div>
        </div>
        <div className="pt-5">
          <NervButton onClick={() => onCreate(buyIn)}>{t('modal.initialize_session')}</NervButton>
        </div>
      </div>
    </NervModal>
  );
}

function JoinRoomModal({ open, onClose, onJoin }: {
  open: boolean; onClose: () => void;
  onJoin: (id: string) => void;
}) {
  const [roomId, setRoomId] = useState('');
  const [buyIn, setBuyIn] = useState(21);
  const { t } = useTranslation();

  return (
    <NervModal open={open} title={t('menu.join')} titleJp="参加" onClose={onClose}>
      <div className="flex flex-col gap-0">
        <div className="flex items-center justify-between py-2.5 border-b border-[rgba(0,255,180,0.08)]">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor">{t('modal.session_id')}</span>
            <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">セッションID</span>
          </div>
          <input
            type="text"
            className="w-36 bg-transparent border-b border-[rgba(0,255,180,0.35)] text-teal font-mono text-xl text-right outline-none pb-0.5 placeholder:text-[rgba(0,255,180,0.2)]"
            value={roomId} placeholder="XXXX"
            onChange={(e) => setRoomId(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-[rgba(0,255,180,0.08)]">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor">{t('modal.buy_in')}</span>
            <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">掛け金</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-4xl tracking-[0.02em] text-bitcoin">{buyIn}</span>
            <span className="font-mono text-[15px] text-[rgba(0,255,180,0.3)]">sats</span>
          </div>
        </div>
        <div className="pt-5">
          <NervButton onClick={() => onJoin(roomId)} disabled={!roomId}>{t('modal.connect_to_session')}</NervButton>
        </div>
      </div>
    </NervModal>
  );
}


function RoomRow({ room, onJoin }: { room: RoomInfo; onJoin: () => void }) {
  const { t } = useTranslation();
  const ageSec = Math.floor((Date.now() - room.createdAt) / 1000);
  const ageLabel = ageSec < 60 ? `${ageSec}s` : `${Math.floor(ageSec / 60)}m`;

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(0,255,180,0.08)]">
      <div className="flex flex-col gap-0.5">
        <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor">
          {room.roomId.slice(0, 8).toUpperCase()}
        </span>
        <span className="font-jp text-[12px] text-[rgba(0,255,180,0.3)]">{room.playerCount}/8 — {ageLabel}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-1">
          <span className="font-display font-bold text-xl tracking-[0.02em] text-bitcoin">{room.buyIn.toLocaleString()}</span>
          <span className="font-jp text-[12px] text-[rgba(0,255,180,0.3)]">sats</span>
        </div>
        <button
          onClick={onJoin}
          className="font-display font-bold text-xl tracking-[0.02em] text-phosphor/40 hover:text-teal transition-colors cursor-pointer border-l border-[rgba(0,255,180,0.1)] pl-4">
          {t('modal.join')}
        </button>
      </div>
    </div>
  );
}


