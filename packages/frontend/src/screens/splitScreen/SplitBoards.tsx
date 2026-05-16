import { useState } from 'react';
import { LocalArena } from '../../components/LocalArena';
import { WINS_TO_MATCH } from '@stacktris/shared';
import { SplitSessionState } from './useSplitSession';
import { ARENA_GAP } from './constants';
import { PlayerSettingsModal } from './PlayerSettingsModal';

type Props = {
  session: SplitSessionState;
  scale: number;
};

function PlayerBoard({ session, scale, index, game }: {
  session: SplitSessionState;
  scale: number;
  index: number;
  game: SplitSessionState['snapshot']['games'][number];
}) {
  const [showSettings, setShowSettings] = useState(false);
  const { snapshot, lightningAddresses, showIntermission, intermissionPlayers, handlePlayerSettings } = session;
  const { status, wins, countdown, roundWinnerId, playerConfigs } = snapshot;
  const pid = `p${index + 1}`;
  const addr = lightningAddresses[pid] ?? '';
  const config = playerConfigs[index];

  return (
    <div className="flex flex-col items-center">
      <LocalArena
        game={game}
        playerLabel={`P${index + 1}`}
        scale={scale}
        wins={wins[pid] ?? 0}
        winsTarget={WINS_TO_MATCH}
        paused={status !== 'playing'}
        showCountdown={status === 'countdown'}
        countdown={countdown}
        showIntermission={showIntermission}
        isRoundWinner={showIntermission && roundWinnerId === pid}
        roundWinnerId={roundWinnerId}
        intermissionPlayers={intermissionPlayers}
      />
      {addr && (
        <span className="font-display text-sm tracking-[0.08em] text-bitcoin/50 mt-1">{addr}</span>
      )}
      <button
        onClick={() => setShowSettings(true)}
        className="mt-1 px-4 py-1 font-display font-bold text-xs tracking-[0.15em] text-phosphor/20 border border-phosphor/10 hover:text-phosphor/50 hover:border-phosphor/30 transition-colors cursor-pointer"
      >
        ⚙ SETTINGS
      </button>
      <PlayerSettingsModal
        open={showSettings}
        playerLabel={`P${index + 1}`}
        dasMs={config?.dasMs ?? 150}
        arrMs={config?.arrMs ?? 16}
        onSave={(das, arr) => handlePlayerSettings(pid, das, arr)}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

export function SplitBoards({ session, scale }: Props) {
  const { snapshot } = session;
  const { games, roundId } = snapshot;

  return (
    <div className="flex items-start justify-center" style={{ gap: ARENA_GAP * scale }}>
      {games.map((game, i) => (
        <PlayerBoard
          key={`${roundId}-${i}`}
          session={session}
          scale={scale}
          index={i}
          game={game}
        />
      ))}
    </div>
  );
}
