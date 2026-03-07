import React, { useEffect, useState } from 'react';
import { GameLobby } from './components/GameLobby';
import { SoloArena } from './components/BattleArena';
import { LightningInvoice } from './components/LightningInvoice';
import { useWebSocket } from './hooks/useWebSocket';
import { GameRoom, ServerMessage } from './types';

type AppState =
  | { screen: 'lobby' }
  | { screen: 'solo' }
  | { screen: 'waiting_payment'; invoice: string; roomId: string; betSats: number }
  | { screen: 'waiting_opponent'; roomId: string }
  | { screen: 'playing'; room: GameRoom }
  | { screen: 'result'; winnerId: string; room: GameRoom };

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

export default function App() {
  const [appState, setAppState] = useState<AppState>({ screen: 'lobby' });
  const { status, lastMessage, connect, send } = useWebSocket(WS_URL);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (!lastMessage) return;
    handleServerMessage(lastMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  function handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'room_created':
        setAppState(prev => ({
          screen: 'waiting_payment',
          invoice: msg.invoice,
          roomId: msg.roomId,
          betSats: prev.screen === 'lobby' ? 0 : (prev as { betSats?: number }).betSats ?? 0,
        }));
        break;
      case 'room_joined':
        setAppState({
          screen: 'waiting_payment',
          invoice: msg.invoice,
          roomId: msg.roomId,
          betSats: 0,
        });
        break;
      case 'game_start':
        setAppState(prev => {
          if (prev.screen === 'waiting_opponent' || prev.screen === 'waiting_payment') {
            return { screen: 'waiting_opponent', roomId: prev.roomId };
          }
          return prev;
        });
        break;
      case 'game_state':
        setAppState({ screen: 'playing', room: msg.room });
        break;
      case 'game_over':
        setAppState(prev => {
          if (prev.screen === 'playing') {
            return { screen: 'result', winnerId: msg.winnerId, room: prev.room };
          }
          return prev;
        });
        break;
      case 'error':
        console.error('Server error:', msg.message);
        break;
    }
  }

  function handleCreateRoom(betSats: number) {
    send({ type: 'create_room', betSats });
  }

  function handleJoinRoom(roomId: string, betSats: number) {
    send({ type: 'join_room', roomId, betSats });
  }

  const connectionBadge = (
    <div style={{
      position: 'fixed', top: '1rem', right: '1rem',
      background: status === 'connected' ? '#0a0' : status === 'connecting' ? '#a80' : '#a00',
      color: '#fff',
      padding: '0.25rem 0.5rem',
      borderRadius: '4px',
      fontSize: '0.7rem',
      letterSpacing: '0.05em',
    }}>
      {status === 'connected' ? '● WS' : status === 'connecting' ? '◌ WS' : '○ WS'}
    </div>
  );

  return (
    <>
      {connectionBadge}

      {appState.screen === 'lobby' && (
        <GameLobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onPlaySolo={() => setAppState({ screen: 'solo' })}
        />
      )}

      {appState.screen === 'solo' && (
        <SoloArena onExit={() => setAppState({ screen: 'lobby' })} />
      )}

      {appState.screen === 'waiting_payment' && (
        <div style={centerStyle}>
          <LightningInvoice
            invoice={appState.invoice}
            amountSats={appState.betSats}
          />
          <button style={backBtn} onClick={() => setAppState({ screen: 'lobby' })}>
            Cancel
          </button>
        </div>
      )}

      {appState.screen === 'waiting_opponent' && (
        <div style={centerStyle}>
          <p style={{ color: '#f7931a', fontSize: '1.2rem' }}>⚡ Payment confirmed!</p>
          <p style={{ color: '#888' }}>Waiting for opponent...</p>
          <p style={{ color: '#444', fontSize: '0.8rem' }}>Room: {appState.roomId}</p>
          <button style={backBtn} onClick={() => setAppState({ screen: 'lobby' })}>
            Cancel
          </button>
        </div>
      )}

      {appState.screen === 'playing' && (
        <div style={centerStyle}>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>
            Battle in progress — full game view coming soon
          </p>
          <p style={{ color: '#444', fontSize: '0.75rem' }}>Room: {appState.room.id}</p>
        </div>
      )}

      {appState.screen === 'result' && (
        <div style={centerStyle}>
          <h2 style={{ color: '#f7931a', fontSize: '2rem' }}>
            {appState.winnerId === 'you' ? '🏆 You Win!' : '💀 You Lose'}
          </h2>
          <p style={{ color: '#888' }}>
            {appState.winnerId === 'you'
              ? `${appState.room.betAmountSats * 2} sats sent to your wallet!`
              : 'Better luck next time.'}
          </p>
          <button
            style={{ ...backBtn, background: '#f7931a', color: '#000' }}
            onClick={() => setAppState({ screen: 'lobby' })}
          >
            Play Again
          </button>
        </div>
      )}
    </>
  );
}

const centerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  gap: '1rem',
};

const backBtn: React.CSSProperties = {
  background: '#1a1a1a',
  border: '1px solid #333',
  color: '#888',
  padding: '0.5rem 1.5rem',
  borderRadius: '4px',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
