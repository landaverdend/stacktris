import { useTranslation } from 'react-i18next';

const ORANGE_GLOW = '0 0 4px rgba(255,112,32,0.6)';

export function RoomCodeBar({ roomId }: { roomId: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-12">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, rgba(230,140,20,0.28), rgba(180,40,60,0.28), rgba(110,20,90,0.28))',
            clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
          }}
        />
        <div className="relative flex items-center h-full px-5 gap-4">
          <div className="flex flex-col items-start leading-none">
            <span className="font-display font-bold text-[15px] tracking-[0.15em]" style={{ color: '#ff7020', textShadow: ORANGE_GLOW }}>{t('room_code.room')}</span>
            <span className="font-display font-bold text-[15px] tracking-[0.15em]" style={{ color: '#ff7020', textShadow: ORANGE_GLOW }}>{t('room_code.code')}</span>
          </div>
          <div className="h-7 w-px bg-white/10" />
          <span className="font-display font-bold text-2xl tracking-[0.2em] text-phosphor">{roomId}</span>
          <button
            onClick={() => navigator.clipboard.writeText(roomId)}
            className="ml-auto font-mono text-[10px] tracking-widest text-phosphor/40 hover:text-phosphor transition-colors cursor-pointer">
            {t('room_code.copy')}
          </button>
        </div>
      </div>
      <div className="h-1 w-[96%]" style={{ background: 'linear-gradient(90deg, rgba(230,140,20,0.18), rgba(180,40,60,0.18), rgba(110,20,90,0.18))' }} />
    </div>
  );
}
