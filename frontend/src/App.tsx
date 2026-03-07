import { useEffect, useState } from 'react';
import { GameLobby } from './components/GameLobby';
import { SoloArena } from './components/BattleArena';
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

  useEffect(() => { connect(); }, [connect]);

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
          invoice: '',
          roomId: msg.room_id,
          betSats: prev.screen === 'lobby' ? 0 : (prev as { betSats?: number }).betSats ?? 0,
        }));
        break;
      case 'room_joined':
        setAppState({ screen: 'waiting_payment', invoice: '', roomId: msg.room_id, betSats: 0 });
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
            return { screen: 'result', winnerId: msg.winner_id, room: prev.room };
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
    send({ type: 'create_room', bet_sats: betSats });
  }

  function handleJoinRoom(roomId: string, betSats: number) {
    send({ type: 'join_room', room_id: roomId, bet_sats: betSats });
  }

  const currentRoomId =
    appState.screen === 'waiting_payment' ? appState.roomId :
    appState.screen === 'waiting_opponent' ? appState.roomId :
    appState.screen === 'playing'          ? appState.room.id :
    null;

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="fixed top-0 inset-x-0 h-10 bg-topbar border-b border-border-dim flex items-center justify-between px-4 z-50">
        <span className="text-bitcoin font-bold tracking-widest text-sm">⚡ STACKTRIS</span>

        {currentRoomId ? (
          <button
            className="text-zinc-600 hover:text-zinc-300 font-mono text-xs px-2 py-1 border border-border rounded transition-colors"
            title="Click to copy room ID"
            onClick={() => navigator.clipboard.writeText(currentRoomId)}
          >
            {currentRoomId}
          </button>
        ) : <span />}

        <span className={`text-xs px-2 py-0.5 rounded font-mono ${
          status === 'connected'  ? 'text-green-400 bg-green-950' :
          status === 'connecting' ? 'text-yellow-400 bg-yellow-950' :
                                    'text-red-400 bg-red-950'
        }`}>
          {status === 'connected' ? '● live' : status === 'connecting' ? '◌ connecting' : '○ offline'}
        </span>
      </div>

      {/* ── Screens ─────────────────────────────────────────────────────────── */}
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
        <Screen>
          <p className="text-zinc-400 text-sm">Waiting for payment confirmation...</p>
          <GhostBtn onClick={() => setAppState({ screen: 'lobby' })}>Cancel</GhostBtn>
        </Screen>
      )}

      {appState.screen === 'waiting_opponent' && (
        <Screen>
          <p className="text-bitcoin text-lg font-bold">⚡ Paid</p>
          <p className="text-zinc-500 text-sm">Waiting for opponent to join...</p>
          <GhostBtn onClick={() => setAppState({ screen: 'lobby' })}>Cancel</GhostBtn>
        </Screen>
      )}

      {appState.screen === 'playing' && (
        <Screen>
          <p className="text-zinc-500 text-sm">Game view coming soon</p>
        </Screen>
      )}

      {appState.screen === 'result' && (
        <Screen>
          <p className="text-4xl font-bold">
            {appState.winnerId === 'you' ? '🏆' : '💀'}
          </p>
          <p className="text-bitcoin text-2xl font-bold">
            {appState.winnerId === 'you' ? 'You Win' : 'You Lose'}
          </p>
          <p className="text-zinc-600 text-sm">
            {appState.winnerId === 'you' ? 'Sats incoming.' : 'Better luck next time.'}
          </p>
          <OrangeBtn onClick={() => setAppState({ screen: 'lobby' })}>Play Again</OrangeBtn>
        </Screen>
      )}
    </>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 pt-10">
      {children}
    </div>
  );
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 px-5 py-2 text-sm text-zinc-500 border border-border-hi rounded hover:text-zinc-300 hover:border-zinc-500 transition-colors"
    >
      {children}
    </button>
  );
}

function OrangeBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 px-8 py-3 bg-bitcoin text-black font-bold rounded hover:opacity-90 transition-opacity"
    >
      {children}
    </button>
  );
}

import React from 'react';
