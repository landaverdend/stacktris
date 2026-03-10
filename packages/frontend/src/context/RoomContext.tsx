import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { ClientMsg } from '@stacktris/shared';
import { useWS, useConnectionStatus } from '../ws/WSContext';
import type { ConnectionStatus, RoomStatus } from '../types';

interface RoomContextValue {
  roomStatus: RoomStatus;
  connectionStatus: ConnectionStatus;
  send: (msg: ClientMsg) => void;
  goToLobby: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const ws = useWS();
  const connectionStatus = useConnectionStatus();
  const [roomStatus, setRoomStatus] = useState<RoomStatus>({ status: 'lobby' });

  useEffect(() => {
    const onRoomCreated = (msg: { type: 'room_created'; room_id: string }) => {
      setRoomStatus({ status: 'waiting_opponent', roomId: msg.room_id, myIndex: 0, players: [] });
    };
    const onRoomJoined = (msg: { type: 'room_joined'; room_id: string }) => {
      setRoomStatus({ status: 'waiting_opponent', roomId: msg.room_id, myIndex: 1, players: [] });
    };

    ws.on('room_created', onRoomCreated);
    ws.on('room_joined', onRoomJoined);


    return () => {
      ws.off('room_created', onRoomCreated);
      ws.off('room_joined', onRoomJoined);
    };
  }, [ws]);

  const send = useCallback((msg: ClientMsg) => ws.send(msg), [ws]);
  const goToLobby = useCallback(() => setRoomStatus({ status: 'lobby' }), []);

  return (
    <RoomContext.Provider value={{ roomStatus, connectionStatus, send, goToLobby }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within a RoomProvider');
  return ctx;
}
