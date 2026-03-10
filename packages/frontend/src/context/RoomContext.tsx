import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { ClientMsg, ServerMsg } from '@stacktris/shared';
import { useWebSocket, ConnectionStatus } from '../hooks/useWebSocket';
import { RoomStatus, ReadyPlayer } from '../types';

// ── Context type ─────────────────────────────────────────────────────────────

interface RoomContextValue {
  roomStatus: RoomStatus;
  connectionStatus: ConnectionStatus;
  send: (msg: ClientMsg) => void;
  goToLobby: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function RoomProvider({ children }: { children: ReactNode }) {
  const [roomStatus, setRoomStatus] = useState<RoomStatus>({ status: 'lobby' });

  const handleMessage = useCallback((msg: ServerMsg) => {
    console.log('[RoomContext] handleMessage: ', msg);

  }, []);

  const { status: connectionStatus, send } = useWebSocket(handleMessage);

  const goToLobby = useCallback(() => {
    setRoomStatus({ status: 'lobby' });
  }, []);

  return (
    <RoomContext.Provider value={{ roomStatus, connectionStatus, send, goToLobby }}>
      {children}
    </RoomContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within a RoomProvider');
  return ctx;
}
