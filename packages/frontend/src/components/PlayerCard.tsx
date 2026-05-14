import { WINS_TO_MATCH } from '@stacktris/shared';
import { useTranslation } from 'react-i18next';
import { cn, truncateName } from '../lib/utils';

const ORANGE_GLOW = '0 0 4px rgba(255,112,32,0.6)';

interface Props {
  index: number;
  playerName: string | null;
  playerId: string;
  wins: number;
  ready: boolean;
  showReadyStatus?: boolean;
  compact?: boolean;
}

export function PlayerCard({ index, playerName, playerId, wins, ready, showReadyStatus = true, compact = false }: Props) {
  const { t } = useTranslation();
  const alpha = 0.4;
  const background = `linear-gradient(90deg, rgba(230,140,20,${alpha}), rgba(180,40,60,${alpha}), rgba(110,20,90,${alpha}))`;
  const accentAlpha = 0.2;
  const accent = `linear-gradient(90deg, rgba(230,140,20,${accentAlpha}), rgba(180,40,60,${accentAlpha}), rgba(110,20,90,${accentAlpha}))`;
  const pips = Array.from({ length: WINS_TO_MATCH }, (_, i) => i < wins ? '■' : '□').join('');
  const name = truncateName(playerName ?? playerId.slice(0, 8).toUpperCase(), 9);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className={cn('relative', compact ? 'h-11' : 'h-16')}>
        <div className="absolute inset-0" style={{ background, clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)' }} />
        <div className="relative flex items-center h-full px-4 gap-3">
          <div className="flex flex-col items-start -mr-1">
            <span className="font-display font-bold leading-none" style={{ fontSize: compact ? '8px' : '10px', color: '#ff7020', letterSpacing: '0.15em', textShadow: ORANGE_GLOW }}>
              {t('players.player_no')}
            </span>
            <span className="font-display font-bold leading-none" style={{ fontSize: compact ? '22px' : '34px', color: '#ff7020', textShadow: ORANGE_GLOW }}>
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex flex-col flex-1 min-w-0 bg-black border border-[var(--color-nerv-dim)] px-2 rounded-md">
            <span className={cn('font-display tracking-[0.02em] truncate text-aqua', compact ? 'text-lg' : 'text-2xl')}>{name}</span>
            <span className={cn('font-display tracking-widest text-alert', compact ? 'text-xs' : 'text-sm')}>{pips}</span>
          </div>

          {showReadyStatus && (
            <span className={cn('font-display font-bold tracking-[0.05em] shrink-0', compact ? 'text-sm' : 'text-base', ready ? 'text-magi' : 'text-phosphor/25')}>
              {ready ? t('players.ready') : t('players.waiting')}
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 w-[96%]" style={{ background: accent }} />
    </div>
  );
}
