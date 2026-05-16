import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { storage } from '../lib/storage';
import { NervModal } from './NervModal';
import { NervButton } from './NervButton';
import { InfoPopover } from './InfoPopover';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, lightningAddress: string) => void;
}

export function OptionsModal({ open, onClose, onSave }: Props) {
  const [name, setName] = useState(() => storage.get('playerName'));
  const [address, setAddress] = useState(() => storage.get('lightningAddress'));
  const [nwcString, setNwcString] = useState(() => storage.get('nwcString'));
  const [showNwc, setShowNwc] = useState(false);
  const [nwcTestStatus, setNwcTestStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [nwcAlias, setNwcAlias] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'ok' | 'invalid' | 'cors'>('idle');
  const [showAddressInfo, setShowAddressInfo] = useState(false);
  const [das, setDas] = useState(() => storage.get('das_ms'));
  const [arr, setArr] = useState(() => storage.get('arr_ms'));
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (open) {
      setName(storage.get('playerName'));
      setAddress(storage.get('lightningAddress'));
      setNwcString(storage.get('nwcString'));
      setVerifyStatus('idle');
      setDas(storage.get('das_ms'));
      setArr(storage.get('arr_ms'));
    }
  }, [open]);

  useEffect(() => { setVerifyStatus('idle'); }, [address]);
  useEffect(() => { setNwcTestStatus('idle'); setNwcAlias(null); }, [nwcString]);

  async function handleNwcTest() {
    if (!nwcString.trim()) return;
    setNwcTestStatus('checking');
    setNwcAlias(null);
    try {
      const { NWCClient } = await import('@getalby/sdk');
      const client = new NWCClient({ nostrWalletConnectUrl: nwcString.trim() });
      const info = await client.getInfo();
      client.close();
      setNwcAlias(info.alias ?? null);
      setNwcTestStatus('ok');
    } catch {
      setNwcTestStatus('error');
    }
  }

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
      setVerifyStatus('cors');
    }
  }

  function handleSave() {
    if (!name.trim()) return;
    storage.set('das_ms', das);
    storage.set('arr_ms', arr);
    storage.set('nwcString', nwcString.trim());
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
            <div className="relative flex items-center" style={{ alignSelf: 'center' }}>
              <button
                onClick={() => setShowAddressInfo(v => !v)}
                className="w-4 h-4 rounded-full border border-teal/40 text-teal/50 hover:border-teal hover:text-teal font-mono text-[9px] leading-none flex items-center justify-center cursor-pointer transition-colors">
                ?
              </button>
              {showAddressInfo && (
                <div className="absolute left-6 top-0 z-50 w-56 bg-black border border-teal/30 p-3 flex flex-col gap-1.5">
                  <p className="font-mono text-[10px] text-teal/80 leading-relaxed">
                    A Lightning Address is like an email address for receiving Bitcoin payments over the Lightning Network.
                  </p>
                  <p className="font-mono text-[10px] text-teal/50 leading-relaxed">
                    Winnings are sent here automatically. Get one free at:
                  </p>
                  <a
                    href="https://www.walletofsatoshi.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-teal hover:text-teal/70 tracking-wider transition-colors">
                    walletofsatoshi.com →
                  </a>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="w-44 bg-transparent border-b border-[rgba(0,255,180,0.35)] text-teal font-mono text-sm text-right outline-none pb-0.5 placeholder:text-[rgba(0,255,180,0.2)]"
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

        <div className="flex flex-col py-2.5 border-b border-[rgba(0,255,180,0.08)] gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor">NWC</span>
              <span className="font-jp text-[15px] text-[rgba(0,255,180,0.3)]">ノード</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type={showNwc ? 'text' : 'password'}
                className="w-44 bg-transparent border-b border-[rgba(0,255,180,0.35)] text-teal font-mono text-sm text-right outline-none pb-0.5 placeholder:text-[rgba(0,255,180,0.2)]"
                value={nwcString}
                placeholder="nostr+walletconnect://..."
                onChange={(e) => setNwcString(e.target.value)}
              />
              <button
                onClick={() => setShowNwc(v => !v)}
                className="font-mono text-[11px] text-[rgba(0,255,180,0.4)] hover:text-teal transition-colors cursor-pointer tracking-widest">
                {showNwc ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {nwcTestStatus === 'ok' && (
              <span className="font-mono text-[11px] text-teal tracking-widest">
                ✓ {nwcAlias ?? 'CONNECTED'}
              </span>
            )}
            {nwcTestStatus === 'error' && (
              <span className="font-mono text-[11px] text-alert tracking-widest">✗ UNREACHABLE</span>
            )}
            <button
              onClick={handleNwcTest}
              disabled={!nwcString.trim() || nwcTestStatus === 'checking'}
              className="font-mono text-[11px] tracking-widest transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-[rgba(0,255,180,0.5)] hover:text-teal">
              {nwcTestStatus === 'checking' ? '◌ ...' : 'TEST'}
            </button>
          </div>
        </div>

        <SliderRow
          label={t('options.das')} jp="遅延" unit="ms"
          value={das} min={0} max={400} step={5}
          description={t('options.das_tip')}
          onChange={setDas}
        />
        <SliderRow
          label={t('options.arr')} jp="速度" unit="ms"
          value={arr} min={0} max={100} step={1}
          description={t('options.arr_tip')}
          onChange={setArr}
        />

        <div className="flex items-center justify-between py-2.5 border-b border-[rgba(0,255,180,0.08)]">
          <span className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor">{t('modal.language')}</span>
          <div className="flex gap-3">
            {(['en', 'es'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => i18n.changeLanguage(lang)}
                className={`font-mono text-sm tracking-widest transition-colors cursor-pointer ${currentLang === lang ? 'text-teal' : 'text-phosphor/30 hover:text-phosphor/60'}`}>
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

function SliderRow({ label, jp, unit, value, min, max, step, description, onChange }: {
  label: string; jp: string; unit: string;
  value: number; min: number; max: number; step: number;
  description: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col py-2.5 border-b border-[rgba(0,255,180,0.08)] gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-bold tracking-[0.02em] text-phosphor">{label}</span>
            <span className="font-jp text-lg text-[rgba(0,255,180,0.3)]">{jp}</span>
          </div>
          <InfoPopover description={description} />
        </div>
        <span className="font-display font-bold text-xl tracking-[0.02em] text-magi tabular-nums">
          {value}<span className="text-[rgba(0,255,180,0.35)] text-sm ml-0.5">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full nerv-range"
        style={{
          background: `linear-gradient(to right, rgba(0,255,180,0.65) ${pct}%, rgba(0,255,180,0.1) ${pct}%)`,
        }}
      />
    </div>
  );
}
