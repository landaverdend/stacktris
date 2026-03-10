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

    switch (msg.type) {
      case 'room_created':
        setRoomStatus({
          status: 'waiting_opponent',
          roomId: msg.room_id,
          myIndex: 0,
          players: [{ index: 0, ready: false }],
        });
        break;

      case 'room_joined':
        setRoomStatus(prev => ({
          status: 'waiting_opponent',
          roomId: msg.room_id,
          myIndex: msg.player_index,
          players: prev.status === 'waiting_opponent' ? prev.players : [],
        }));
        break;

      case 'ready_update':
        setRoomStatus(prev => {
          if (prev.status !== 'waiting_opponent') return prev;
          return { ...prev, players: msg.players as ReadyPlayer[] };
        });
        break;

      case 'game_start': {
        console.log('[RoomContext] game_start: ', msg);
        break;
      }

      case 'game_over':
        setRoomStatus({
          status: 'result',
          youWon: msg.you_won,
          yourScore: msg.your_score,
          opponentScore: msg.opponent_score,
        });
        break;

      case 'error':
        console.error('[RoomContext] Server error:', msg.message);
        break;
    }
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
