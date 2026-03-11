import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { RoomState } from '@stacktris/shared';
import { useWS, useConnectionStatus } from '../ws/WSContext';
import type { ConnectionStatus, } from '../types';
import { useNavigate } from 'react-router-dom';

interface RoomContextValue {
  connectionStatus: ConnectionStatus;
  roomState: RoomState;

  leaveRoom: () => void;
  createRoom: (amountBet: number) => void;
  joinRoom: (roomId: string) => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const ws = useWS();

  const connectionStatus = useConnectionStatus();

  const [roomState, setRoomState] = useState<RoomState>({ players: [], roomId: '', status: 'waiting' });

  useEffect(() => {
    const onRoomCreated = (msg: { type: 'room_created'; room_id: string }) => {
      navigate(`/room/${msg.room_id}`)
    };

    const onRoomJoined = (msg: { type: 'room_joined'; room_id: string }) => {
      navigate(`/room/${msg.room_id}`)
    };

    const onRoomStateUpdate = (msg: { type: 'room_state_update'; roomState: RoomState }) => {
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

  const createRoom = useCallback((amountBet: number) => { ws.send({ type: 'create_room', bet_sats: amountBet }) }, [ws])

  const joinRoom = useCallback((roomId: string) => { ws.send({ type: 'join_room', room_id: roomId }) }, [ws])

  const leaveRoom = useCallback(() => { ws.send({ type: 'leave_room', room_id: roomState.roomId }) }, [ws])

  return <RoomContext.Provider value={{ connectionStatus, roomState, leaveRoom, createRoom, joinRoom }}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within a RoomProvider');
  return ctx;
}
