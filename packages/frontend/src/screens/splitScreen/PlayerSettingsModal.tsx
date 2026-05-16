import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NervModal } from '../../components/NervModal';
import { InfoPopover } from '../../components/InfoPopover';

const DEFAULT_DAS = 150;
const DEFAULT_ARR = 16;

const PRESETS = [
  { label: 'STANDARD', das: 150, arr: 16 },
  { label: 'FAST', das: 83, arr: 10 },
  { label: 'SONIC', das: 83, arr: 0 },
] as const;

type Props = {
  open: boolean;
  playerLabel: string;
  dasMs: number;
  arrMs: number;
  onSave: (das: number, arr: number) => void;
  onClose: () => void;
};

export function PlayerSettingsModal({ open, playerLabel, dasMs, arrMs, onSave, onClose }: Props) {
  const [das, setDas] = useState(dasMs);
  const [arr, setArr] = useState(arrMs);
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      setDas(dasMs);
      setArr(arrMs);
    }
  }, [open, dasMs, arrMs]);

  function handleSave() {
    onSave(das, arr);
    onClose();
  }

  return (
    <NervModal open={open} title={playerLabel} titleJp="設定" onClose={onClose}>
      <div className="flex flex-col gap-6">

        {/* Presets */}
        <div className="flex gap-2">
          {PRESETS.map((p) => {
            const active = das === p.das && arr === p.arr;
            return (
              <button
                key={p.label}
                onClick={() => { setDas(p.das); setArr(p.arr); }}
                className={`flex-1 py-2 font-display font-bold text-sm tracking-[0.08em] border transition-colors cursor-pointer ${
                  active
                    ? 'border-bitcoin text-bitcoin'
                    : 'border-phosphor/20 text-phosphor/40 hover:border-phosphor/50 hover:text-phosphor/70'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* DAS */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor">DAS</span>
                <span className="font-jp text-xs text-phosphor/30">遅延自動シフト</span>
              </div>
              <InfoPopover description={t('options.das_tip')} />
            </div>
            <span className="font-display font-bold text-3xl tracking-[0.02em] text-bitcoin">
              {das}<span className="text-sm text-phosphor/40 ml-1">ms</span>
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={300}
            step={1}
            value={das}
            onChange={(e) => setDas(Number(e.target.value))}
            className="w-full accent-bitcoin h-1"
          />
          <div className="flex justify-between">
            <span className="font-display text-xs text-phosphor/25 tracking-[0.05em]">0ms</span>
            <span className="font-display text-xs text-phosphor/25 tracking-[0.05em]">300ms</span>
          </div>
        </div>

        {/* ARR */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="font-display font-bold text-2xl tracking-[0.02em] text-phosphor">ARR</span>
                <span className="font-jp text-xs text-phosphor/30">自動連打速度</span>
              </div>
              <InfoPopover description={t('options.arr_tip')} />
            </div>
            <span className="font-display font-bold text-3xl tracking-[0.02em] text-bitcoin">
              {arr === 0 ? (
                <span>INSTANT</span>
              ) : (
                <>{arr}<span className="text-sm text-phosphor/40 ml-1">ms</span></>
              )}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={arr}
            onChange={(e) => setArr(Number(e.target.value))}
            className="w-full accent-bitcoin h-1"
          />
          <div className="flex justify-between">
            <span className="font-display text-xs text-phosphor/25 tracking-[0.05em]">INSTANT</span>
            <span className="font-display text-xs text-phosphor/25 tracking-[0.05em]">100ms</span>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full py-3 font-display font-bold text-2xl tracking-[0.08em] border-2 border-teal text-teal hover:bg-teal/10 transition-colors cursor-pointer"
        >
          SAVE
        </button>
      </div>
    </NervModal>
  );
}
