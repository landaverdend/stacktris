import { useState } from 'react';
import { useConnection } from '../ws/WSContext';
import { useTranslation } from 'react-i18next';

export function NameEntryScreen() {
  const { setPlayerInfo } = useConnection();
  const [name, setName] = useState('');
  const [lightningAddress, setLightningAddress] = useState('');
  const [showAddressInfo, setShowAddressInfo] = useState(false);
  const { t } = useTranslation();

  const canSubmit = name.trim() && lightningAddress.trim();

  const submit = () => {
    if (!canSubmit) return;
    setPlayerInfo(name.trim(), lightningAddress.trim());
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      {/* Epilepsy warning */}
      <p className="absolute top-6 left-0 right-0 text-center font-display text-[11px] tracking-[0.15em] text-phosphor/20">
        {t('name_entry.warning')}
      </p>

      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <span className="font-display font-bold text-6xl tracking-tight text-phosphor leading-none">
            {t('name_entry.enter_name')}
          </span>
          <span className="font-jp text-[15px] text-phosphor/30 tracking-widest">名前を入力してください</span>
        </div>

        <div className="flex flex-col items-center gap-4">
          <input
            autoFocus
            maxLength={16}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('name_entry.placeholder_name')}
            className="bg-black border border-phosphor/40 text-phosphor font-display font-bold text-4xl tracking-tight text-center w-80 py-3 px-4 outline-none focus:border-phosphor placeholder:text-phosphor/20 placeholder:text-3xl"
          />

          <div className="flex flex-col items-center gap-1 w-80">
            <input
              value={lightningAddress}
              onChange={e => setLightningAddress(e.target.value)}
              onKeyDown={handleKey}
              placeholder="you@wallet.com"
              className="bg-black border border-phosphor/40 text-phosphor font-display text-xl tracking-tight text-center w-full py-3 px-4 outline-none focus:border-phosphor placeholder:text-phosphor/20"
            />
            <div className="flex items-center gap-2">
              <span className="font-display text-[11px] tracking-widest text-phosphor/30">{t('name_entry.lightning_address')}</span>
              <div className="relative">
                <button
                  onClick={() => setShowAddressInfo(v => !v)}
                  className="w-4 h-4 rounded-full border border-phosphor/30 text-phosphor/40 hover:border-phosphor hover:text-phosphor font-mono text-[9px] leading-none flex items-center justify-center cursor-pointer transition-colors">
                  ?
                </button>
                {showAddressInfo && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-60 bg-black border border-phosphor/25 p-3 flex flex-col gap-2">
                    <p className="font-mono text-[10px] text-phosphor/70 leading-relaxed">
                      A Lightning Address is like an email address for receiving Bitcoin payments instantly.
                    </p>
                    <p className="font-mono text-[10px] text-phosphor/40 leading-relaxed">
                      Winnings are sent here automatically. Get one free at:
                    </p>
                    <a
                      href="https://www.walletofsatoshi.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-phosphor/70 hover:text-phosphor tracking-wider transition-colors">
                      walletofsatoshi.com →
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="font-display font-bold text-4xl tracking-tight text-black bg-phosphor px-12 py-3 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-opacity"
        >
          {t('name_entry.confirm')}
        </button>
      </div>
    </div>
  );
}
