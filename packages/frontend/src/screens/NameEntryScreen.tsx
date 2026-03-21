import { useState } from 'react';
import { useConnection } from '../ws/WSContext';

export function NameEntryScreen() {
  const { setPlayerInfo } = useConnection();
  const [name, setName] = useState('');
  const [lightningAddress, setLightningAddress] = useState('');

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
        ⚠ WARNING: THIS GAME CONTAINS FLASHING LIGHTS THAT MAY AFFECT PEOPLE WITH PHOTOSENSITIVE EPILEPSY
      </p>

      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <span className="font-display font-bold text-6xl tracking-tight text-phosphor leading-none">
            ENTER YOUR NAME
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
            placeholder="YOUR NAME"
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
            <span className="font-display text-[11px] tracking-widest text-phosphor/30">LIGHTNING ADDRESS (REQUIRED)</span>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="font-display font-bold text-4xl tracking-tight text-black bg-phosphor px-12 py-3 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-opacity"
        >
          CONFIRM
        </button>
      </div>
    </div>
  );
}
