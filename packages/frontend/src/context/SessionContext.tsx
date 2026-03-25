import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { SessionState } from '@stacktris/shared';
import { useWS, useConnection } from '../ws/WSContext';
import type { ConnectionStatus } from '../types';
import { useNavigate } from 'react-router-dom';

type RoomStateWithPayment = SessionState & { bolt11?: string; expiresAt?: number; invoicePaid: boolean; payoutPending?: { amountSats: number; lightningAddress: string } };
interface RoomContextValue {
  connectionStatus: ConnectionStatus;
  roomState: RoomStateWithPayment;

  leaveRoom: () => void;
  createRoom: (amountBet: number) => void;
  joinRoom: (roomId: string) => void;
  readyUpdate: (readyState: boolean) => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

const initialRoomState: RoomStateWithPayment = { players: [], roomId: '', status: 'waiting', matchWinnerId: null, invoicePaid: false, buyIn: 0, roundWinnerId: null, potSats: 0 };

export function RoomProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const ws = useWS();

  const { status: connectionStatus } = useConnection();

  const [roomState, setRoomState] = useState<RoomStateWithPayment>(initialRoomState);

  useEffect(() => {
    const onRoomCreated = (msg: { type: 'session_created'; room_id: string }) => {
      navigate(`/room/${msg.room_id}`)
    };

    const onRoomJoined = (msg: { type: 'session_joined'; room_id: string }) => {
      navigate(`/room/${msg.room_id}`)
    };

    const onRoomStateUpdate = (msg: { type: 'session_state_update'; roomState: SessionState }) => {
      setRoomState(prev => ({ ...prev, ...msg.roomState }));
    };

    const onBetInvoiceIssued = (msg: { type: 'bet_invoice_issued'; bolt11: string; expiresAt: number }) => {
      console.log('[RoomContext] bet invoice issued:', msg);
      setRoomState(prev => ({ ...prev, bolt11: msg.bolt11 }));
    };

    const onBetPaymentConfirmed = (msg: { type: 'bet_payment_confirmed'; playerId: string }) => {
      console.log('[RoomContext] bet payment confirmed:', msg);
      setRoomState(prev => ({ ...prev, invoicePaid: true }));
    };

    const onPayoutPending = (msg: { type: 'payout_pending'; amountSats: number; lightningAddress: string }) => {
      console.error('[RoomContext] payout pending — server could not pay winner:', msg);
      setRoomState(prev => ({ ...prev, payoutPending: { amountSats: msg.amountSats, lightningAddress: msg.lightningAddress } }));
    };

    ws.on('session_created', onRoomCreated);
    ws.on('session_joined', onRoomJoined);
    ws.on('session_state_update', onRoomStateUpdate);
    ws.on('bet_invoice_issued', onBetInvoiceIssued);
    ws.on('bet_payment_confirmed', onBetPaymentConfirmed);
    ws.on('payout_pending', onPayoutPending);

    return () => {
      ws.off('session_created', onRoomCreated);
      ws.off('session_joined', onRoomJoined);
      ws.off('session_state_update', onRoomStateUpdate);
      ws.off('bet_invoice_issued', onBetInvoiceIssued);
      ws.off('payout_pending', onPayoutPending);
    };
  }, [ws]);

  const createRoom = useCallback((amountBet: number) => { ws.send({ type: 'create_room', buy_in: amountBet }) }, [ws])

  const joinRoom = useCallback((roomId: string) => { ws.send({ type: 'join_room', room_id: roomId }) }, [ws])

  const leaveRoom = useCallback(() => { ws.send({ type: 'leave_room', room_id: roomState.roomId }); setRoomState(initialRoomState); }, [ws])

  const readyUpdate = useCallback((readyState: boolean) => { ws.send({ type: 'ready_update', ready: readyState }) }, [ws])

  return <RoomContext.Provider value={{ connectionStatus, roomState, leaveRoom, createRoom, joinRoom, readyUpdate }}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within a RoomProvider');
  return ctx;
}
