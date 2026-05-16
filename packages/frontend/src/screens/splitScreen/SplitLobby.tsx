import { SplitSessionState } from './useSplitSession';
import { LobbyArena } from './LobbyArena';
import { ARENA_GAP } from './constants';

type Props = {
  session: SplitSessionState;
  scale: number;
};

export function SplitLobby({ session, scale }: Props) {
  const {
    buyIn,
    invoices,
    invoiceErrors,
    lightningAddresses,
    nwcMissing,
    snapshot,
    handleAddressChange,
    handlePlayerSettings,
    toggleReady,
  } = session;
  const { playerConfigs, readyState, wins } = snapshot;

  return (
    <div className="flex items-start justify-center flex-wrap" style={{ gap: ARENA_GAP * scale }}>
      {playerConfigs.map((config, i) => (
        <LobbyArena
          key={config.playerId}
          index={i}
          playerName={config.displayName}
          buyIn={buyIn}
          wins={wins[config.playerId] ?? 0}
          ready={readyState[config.playerId] ?? false}
          paid={config.paid}
          bolt11={invoices[config.playerId] ?? null}
          invoiceError={invoiceErrors[config.playerId] ?? null}
          nwcMissing={nwcMissing}
          lightningAddress={lightningAddresses[config.playerId] ?? ''}
          onLightningAddressChange={(addr) => handleAddressChange(config.playerId, addr)}
          onToggleReady={() => toggleReady(config.playerId, !(readyState[config.playerId] ?? false))}
          onSettingsChange={(das, arr) => handlePlayerSettings(config.playerId, das, arr)}
          dasMs={config.dasMs ?? 150}
          arrMs={config.arrMs ?? 16}
          scale={scale}
        />
      ))}
    </div>
  );
}
