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

export function useConnectionStatus(): ConnectionStatus {
  const ws = useWS();
  const [status, setStatus] = useState<ConnectionStatus>(ws.getStatus());
  useEffect(() => ws.onStatus(setStatus), [ws]);
  return status;
}
