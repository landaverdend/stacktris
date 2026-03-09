import { useEffect, useState } from 'react';
import { GameClient, GameClientState, getGameClient } from '../client/GameClient';

export function useGameClient(): { state: GameClientState; client: GameClient } {
  const client = getGameClient();

  const [state, setState] = useState<GameClientState>(() => client.getState());

  useEffect(() => {
    const unsub = client.subscribe(setState);
    client.connect();
    return unsub;
  }, [client]);

  return { state, client };
}
