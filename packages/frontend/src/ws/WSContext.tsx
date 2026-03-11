import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { WSClient, ConnectionStatus } from './WSClient';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

const client = new WSClient(WS_URL);

const WSContext = createContext<WSClient | null>(null);

export function WSProvider({ children }: { children: ReactNode }) {
  useEffect(() => { client.connect(); }, []);
  return <WSContext.Provider value={client}>{children}</WSContext.Provider>;
}

export function useWS(): WSClient {
  const ctx = useContext(WSContext);
  if (!ctx) throw new Error('useWS must be used within WSProvider');
  return ctx;
}

export function useConnection(): { status: ConnectionStatus; playerId: string | null } {
  const [status, setStatus] = useState<ConnectionStatus>(client.getStatus());
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    client.on('welcome', msg => setPlayerId(msg.player_id));
    return client.onStatus(setStatus);
  }, []);

  return { status, playerId };
}
