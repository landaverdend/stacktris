import { useEffect, useState } from 'react';
import { COUNTDOWN_SECONDS } from '@stacktris/shared';
import { useTranslation } from 'react-i18next';

interface Props {
  countdown: number;
}

export function BoardCountdown({ countdown }: Props) {
  const { t } = useTranslation();
  const [display, setDisplay] = useState<number | 'GO!'>(countdown);

  useEffect(() => {
    setDisplay(countdown);
  }, [countdown]);

  useEffect(() => {
    if (countdown <= 0) {
      setDisplay('GO!');
    }
  }, [countdown]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
      <p className="text-phosphor font-display font-bold leading-none" style={{ fontSize: '7rem' }}>
        {display}
      </p>
      <p className="text-nerv-dim text-[15px] font-jp tracking-widest">{t('multiplayer.round_start')}</p>
    </div>
  );
}
