import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { ClientMsg, RoomState } from '@stacktris/shared';
import { useWS, useConnectionStatus } from '../ws/WSContext';
import type { ConnectionStatus, } from '../types';

interface RoomContextValue {
  connectionStatus: ConnectionStatus;
  roomState: RoomState;
  send: (msg: ClientMsg) => void;
  resetRoom: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const ws = useWS();

  const connectionStatus = useConnectionStatus();

  const [roomState, setRoomState] = useState<RoomState>({ players: [], roomId: '' });

  useEffect(() => {
    const onRoomCreated = (msg: { type: 'room_created'; room_id: string }) => {
      console.log('onRoomCreated: ', msg);
    };

    const onRoomJoined = (msg: { type: 'room_joined'; room_id: string }) => {
      console.log('onRoomJoined: ', msg);
    };

    const onRoomStateUpdate = (msg: { type: 'room_state_update'; roomState: RoomState }) => {
      console.log('[RoomContext] onRoomStateUpdate: ', msg.roomState);
      setRoomState(msg.roomState);
    };

    ws.on('room_created', onRoomCreated);
    ws.on('room_joined', onRoomJoined);
    ws.on('room_state_update', onRoomStateUpdate);

    return () => {
      ws.off('room_created', onRoomCreated);
      ws.off('room_joined', onRoomJoined);
      ws.off('room_state_update', onRoomStateUpdate);
    };
  }, [ws]);

  const send = useCallback((msg: ClientMsg) => ws.send(msg), [ws]);
  const resetRoom = useCallback(() => { }, []);

  return <RoomContext.Provider value={{ connectionStatus, roomState, send, resetRoom }}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within a RoomProvider');
  return ctx;
}
