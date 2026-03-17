import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { WSClient, ConnectionStatus } from './WSClient';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

const client = new WSClient(WS_URL);

type WSContextValue = {
  client: WSClient;
  playerId: string | null;
  playerName: string | null;
  setPlayerName: (name: string) => void;
};

const WSContext = createContext<WSContextValue | null>(null);

export function WSProvider({ children }: { children: ReactNode }) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerNameState] = useState<string | null>(
    () => localStorage.getItem('playerName')
  );

  useEffect(() => {
    client.connect();
    client.on('welcome', (msg) => {
      setPlayerId(msg.player_id);
      const saved = localStorage.getItem('playerName');
      if (saved) client.send({ type: 'set_player_name', name: saved });
    });
  }, []);

  const setPlayerName = (name: string) => {
    localStorage.setItem('playerName', name);
    client.send({ type: 'set_player_name', name });
    setPlayerNameState(name);
  };

  return (
    <WSContext.Provider value={{ client, playerId, playerName, setPlayerName }}>
      {children}
    </WSContext.Provider>
  );
}

export function useWS(): WSClient {
  const ctx = useContext(WSContext);
  if (!ctx) throw new Error('useWS must be used within WSProvider');
  return ctx.client;
}

export function useConnection(): {
  status: ConnectionStatus;
  playerId: string | null;
  playerName: string | null;
  setPlayerName: (name: string) => void;
} {
  const ctx = useContext(WSContext);
  const [status, setStatus] = useState<ConnectionStatus>(client.getStatus());

  useEffect(() => client.onStatus(setStatus), []);

  return {
    status,
    playerId: ctx?.playerId ?? null,
    playerName: ctx?.playerName ?? null,
    setPlayerName: ctx?.setPlayerName ?? (() => {}),
  };
}
