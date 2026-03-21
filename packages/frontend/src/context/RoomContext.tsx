import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { RoomState } from '@stacktris/shared';
import { useWS, useConnection } from '../ws/WSContext';
import type { ConnectionStatus } from '../types';
import { useNavigate } from 'react-router-dom';

interface RoomContextValue {
  connectionStatus: ConnectionStatus;
  roomState: RoomState;

  leaveRoom: () => void;
  createRoom: (amountBet: number) => void;
  joinRoom: (roomId: string) => void;
  readyUpdate: (readyState: boolean) => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const ws = useWS();

  const { status: connectionStatus } = useConnection();

  const [roomState, setRoomState] = useState<RoomState>({ players: [], roomId: '', status: 'waiting', matchWinnerId: null });

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

    const onBetInvoiceIssued = (msg: { type: 'bet_invoice_issued'; bolt11: string; expiresAt: number }) => {
      console.log('[RoomContext] bet invoice issued:', msg);
    };

    ws.on('room_created', onRoomCreated);
    ws.on('room_joined', onRoomJoined);
    ws.on('room_state_update', onRoomStateUpdate);
    ws.on('bet_invoice_issued', onBetInvoiceIssued);


    return () => {
      ws.off('room_created', onRoomCreated);
      ws.off('room_joined', onRoomJoined);
      ws.off('room_state_update', onRoomStateUpdate);
      ws.off('bet_invoice_issued', onBetInvoiceIssued);
    };
  }, [ws]);

  const createRoom = useCallback((amountBet: number) => { ws.send({ type: 'create_room', bet_sats: amountBet }) }, [ws])

  const joinRoom = useCallback((roomId: string) => { ws.send({ type: 'join_room', room_id: roomId }) }, [ws])

  const leaveRoom = useCallback(() => { ws.send({ type: 'leave_room', room_id: roomState.roomId }) }, [ws])

  const readyUpdate = useCallback((readyState: boolean) => { ws.send({ type: 'ready_update', ready: readyState }) }, [ws])

  return <RoomContext.Provider value={{ connectionStatus, roomState, leaveRoom, createRoom, joinRoom, readyUpdate }}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within a RoomProvider');
  return ctx;
}
