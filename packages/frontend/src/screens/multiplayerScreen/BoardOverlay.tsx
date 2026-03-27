import { PlayerInfo, SessionStatus } from '@stacktris/shared';
import { ScrollFlareOverlay } from '../../components/ScrollFlareOverlay';
import { RoomStagingOverlay } from './RoomStagingOverlay';
import { SessionWinnerOverlay } from './SessionWinnerOverlay';
import { IntermissionOverlay } from './IntermissionOverlay';

interface Props {
  status: SessionStatus;
  playerId: string;
  isClientAlive: boolean;
  roundWinnerId: string | null;
  matchWinnerId: string | null;
  players: PlayerInfo[];
  potSats: number;
  payoutPending?: { amountSats: number; lightningAddress: string };
}

export function BoardOverlay({
  status,
  playerId,
  isClientAlive,
  roundWinnerId,
  matchWinnerId,
  players,
  potSats,
  payoutPending,
}: Props) {
  if (status === 'waiting') return <RoomStagingOverlay />;

  if (status === 'finished') {
    const winner = players.find(p => p.playerId === matchWinnerId) as PlayerInfo;
    return <SessionWinnerOverlay winner={winner} potSats={potSats} payoutPending={payoutPending} />;
  }


  if (status === 'intermission') {
    const isRoundWinner = playerId === roundWinnerId;
    return (
      <>

        {!isClientAlive && <ScrollFlareOverlay />}
        {true && <ScrollFlareOverlay word="CLEARED" color="#00ff88" fontSize={45} />}
        <IntermissionOverlay roundWinnerId={roundWinnerId} players={players} />
      </>
    );
  }

  // Player just died while the game is running
  if (status === 'playing' && !isClientAlive) return <ScrollFlareOverlay />;

  return null;
}
