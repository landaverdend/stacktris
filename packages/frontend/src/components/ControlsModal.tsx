import { useState } from 'react';
import { NervModal } from './NervModal';
import { useTranslation } from 'react-i18next';

const CONTROLS = [
  { keys: ['←', '→'], key: 'controls.move', jp: '移動' },
  { keys: ['↓'], key: 'controls.soft_drop', jp: 'ソフトドロップ' },
  { keys: ['↑', 'X'], key: 'controls.rotate_cw', jp: '時計回り' },
  { keys: ['Z'], key: 'controls.rotate_ccw', jp: '反時計回り' },
  { keys: ['SPACE'], key: 'controls.hard_drop', jp: 'ハードドロップ' },
  { keys: ['C'], key: 'controls.hold', jp: 'ホールド' },
];

export function ControlsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <NervModal open={open} title={t('menu.controls')} titleJp="操作方法" onClose={onClose}>
      <div className="flex flex-col gap-1">
        {CONTROLS.map(({ keys, key, jp }) => (
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

/** Drop-in trigger button + modal in one. */
export function ControlsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className}>
        {t('menu.controls')}
      </button>
      <ControlsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
