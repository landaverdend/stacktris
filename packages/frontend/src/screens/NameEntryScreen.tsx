import { useState } from 'react';
import { useConnection } from '../ws/WSContext';

export function NameEntryScreen() {
  const { setPlayerName } = useConnection();
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) setPlayerName(trimmed);
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

      {/* Name entry */}
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <span className="font-display font-bold text-6xl tracking-tight text-phosphor leading-none">
            ENTER YOUR NAME
          </span>
          <span className="font-jp text-[15px] text-phosphor/30 tracking-widest">名前を入力してください</span>
        </div>

        <input
          autoFocus
          maxLength={16}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="YOUR NAME"
          className="bg-black border border-phosphor/40 text-phosphor font-display font-bold text-4xl tracking-tight text-center w-80 py-3 px-4 outline-none focus:border-phosphor placeholder:text-phosphor/20 placeholder:text-3xl"
        />

        <button
          onClick={submit}
          disabled={!value.trim()}
          className="font-display font-bold text-4xl tracking-tight text-black bg-phosphor px-12 py-3 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-opacity"
        >
          CONFIRM
        </button>
      </div>
    </div>
  );
}
