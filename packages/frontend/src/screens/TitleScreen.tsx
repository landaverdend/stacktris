import { useEffect, useState } from 'react';
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
import { useTranslation } from 'react-i18next';

const API_BASE = `${window.location.protocol}//${window.location.host}`;

const MENU = [
  { id: 'solo', key: 'menu.solo', jp: 'ソロプレイ' },
  { id: 'battle', key: 'menu.multiplayer', jp: 'バトル' },
  { id: 'create', key: 'menu.create', jp: '作成' },
  { id: 'join', key: 'menu.join', jp: '参加' },
  { id: 'controls', key: 'menu.controls', jp: '操作方法' },
  { id: 'options', key: 'menu.options', jp: '設定' },
] as const;

export function TitleScreen() {
  const navigate = useNavigate();
  const { createRoom, joinRoom } = useRoom();
  const { setPlayerInfo } = useConnection();
  const { t } = useTranslation();

  const [modal, setModal] = useState<'battle' | 'create' | 'join' | 'controls' | 'options' | null>(null);
  const close = () => setModal(null);

  function handleItem(id: (typeof MENU)[number]['id']) {
    if (id === 'solo') { navigate('/solo'); return; }
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
  const [buyIn, setBuyIn] = useState(21);
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
              className="w-28 bg-transparent border-b border-[rgba(0,255,180,0.35)] text-teal font-display font-bold text-2xl tracking-[0.02em] text-right outline-none pb-0.5"
              value={buyIn} min={0}
              onChange={(e) => setBuyIn(Number(e.target.value))}
            />
            <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">sats</span>
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

function ControlsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();

  const controls = [
    { keys: ['←', '→'], key: 'controls.move', jp: '移動' },
    { keys: ['↓'], key: 'controls.soft_drop', jp: 'ソフトドロップ' },
    { keys: ['↑', 'X'], key: 'controls.rotate_cw', jp: '時計回り' },
    { keys: ['Z'], key: 'controls.rotate_ccw', jp: '反時計回り' },
    { keys: ['SPACE'], key: 'controls.hard_drop', jp: 'ハードドロップ' },
    { keys: ['C'], key: 'controls.hold', jp: 'ホールド' },
  ];

  return (
    <NervModal open={open} title={t('menu.controls')} titleJp="操作方法" onClose={onClose}>
      <div className="flex flex-col gap-1">
        {controls.map(({ keys, key, jp }) => (
          <div key={key} className="flex items-center justify-between py-2.5 border-b border-[rgba(0,255,180,0.08)] last:border-0">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl tracking-[0.02em] text-phosphor font-bold">{t(key)}</span>
              <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">{jp}</span>
            </div>
            <div className="flex gap-1.5">
              {keys.map((k) => (
                <kbd key={k} className="px-1 py-0.5 border-[rgba(0,255,180,0.35)] bg-[rgba(0,255,180,0.04)] font-display font-bold text-[20px] text-[rgba(0,255,180,0.7)] tracking-[0.02em] rounded-md border-2">{k}</kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </NervModal>
  );
}

function OptionsModal({ open, onClose, onSave }: {
  open: boolean; onClose: () => void;
  onSave: (name: string, lightningAddress: string) => void;
}) {
  const [name, setName] = useState(() => localStorage.getItem('playerName') ?? '');
  const [address, setAddress] = useState(() => localStorage.getItem('lightningAddress') ?? '');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'ok' | 'invalid' | 'cors'>('idle');
  const { t, i18n } = useTranslation();

  // Reset fields to current stored values each time modal opens
  useEffect(() => {
    if (open) {
      setName(localStorage.getItem('playerName') ?? '');
      setAddress(localStorage.getItem('lightningAddress') ?? '');
      setVerifyStatus('idle');
    }
  }, [open]);

  // Reset verify status when address changes
  useEffect(() => { setVerifyStatus('idle'); }, [address]);

  const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

  async function handleVerify() {
    if (!isValidFormat) { setVerifyStatus('invalid'); return; }
    setVerifyStatus('checking');
    const [user, domain] = address.split('@');
    try {
      const res = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
      if (!res.ok) { setVerifyStatus('invalid'); return; }
      const json = await res.json();
      setVerifyStatus(json?.tag === 'payRequest' ? 'ok' : 'invalid');
    } catch {
      // CORS or network failure — can't confirm, but not necessarily wrong
      setVerifyStatus('cors');
    }
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave(name.trim(), address.trim());
    onClose();
  }

  const verifyLabel: Record<typeof verifyStatus, string> = {
    idle: t('modal.verify'),
    checking: '◌ ...',
    ok: t('modal.valid'),
    invalid: t('modal.invalid'),
    cors: t('modal.unconfirmed'),
  };
  const verifyColor: Record<typeof verifyStatus, string> = {
    idle: 'text-[rgba(0,255,180,0.5)]',
    checking: 'text-[rgba(0,255,180,0.5)]',
    ok: 'text-teal',
    invalid: 'text-alert',
    cors: 'text-bitcoin',
  };

  const currentLang = i18n.language?.startsWith('es') ? 'es' : 'en';

  return (
    <NervModal open={open} title={t('menu.options')} titleJp="設定" onClose={onClose}>
      <div className="flex flex-col gap-0">
        <div className="flex items-center justify-between py-2.5 border-b border-[rgba(0,255,180,0.08)]">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor">{t('modal.name')}</span>
            <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">名前</span>
          </div>
          <input
            type="text"
            className="w-40 bg-transparent border-b border-[rgba(0,255,180,0.35)] text-teal font-mono text-sm text-right outline-none pb-0.5 placeholder:text-[rgba(0,255,180,0.2)]"
            value={name}
            placeholder="OPERATOR"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-[rgba(0,255,180,0.08)]">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor">{t('modal.address')}</span>
            <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">アドレス</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="w-44 bg-transparent border-b border-[rgba(0,255,180,0.35)] text-teal font-mono text-xs text-right outline-none pb-0.5 placeholder:text-[rgba(0,255,180,0.2)]"
              value={address}
              placeholder="you@wallet.domain"
              onChange={(e) => setAddress(e.target.value)}
            />
            <button
              onClick={handleVerify}
              disabled={!address || verifyStatus === 'checking'}
              className={`font-mono text-[11px] tracking-widest transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${verifyColor[verifyStatus]}`}>
              {verifyLabel[verifyStatus]}
            </button>
          </div>
        </div>
        {verifyStatus === 'cors' && (
          <p className="font-mono text-[10px] text-bitcoin/60 pt-1.5">
            {t('modal.cors_warning', { domain: address.split('@')[1] })}
          </p>
        )}
        <div className="flex items-center justify-between py-2.5 border-b border-[rgba(0,255,180,0.08)]">
          <span className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor">{t('modal.language')}</span>
          <div className="flex gap-3">
            {(['en', 'es'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => i18n.changeLanguage(lang)}
                className={`font-mono text-sm tracking-widest transition-colors cursor-pointer ${currentLang === lang ? 'text-teal' : 'text-phosphor/30 hover:text-phosphor/60'}`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="pt-5">
          <NervButton onClick={handleSave} disabled={!name.trim()}>{t('modal.save_changes')}</NervButton>
        </div>
      </div>
    </NervModal>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

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


function NervButton({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="w-full py-3 border border-[rgba(0,255,180,0.4)] text-phosphor font-display font-bold text-4xl tracking-[0.02em] hover:border-[rgba(0,255,180,0.8)] hover:text-teal transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer">
      {children}
    </button>
  );
}
