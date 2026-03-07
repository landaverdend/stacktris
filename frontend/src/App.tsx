import { useState } from 'react';
import { NavBar } from './components/NavBar';
import { SoloArena } from './components/BattleArena';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';

type View = 'lobby' | 'solo' | 'game';

export default function App() {
  const [view, setView] = useState<View>('lobby');

  return (
    <>
      <NavBar />

      {view === 'lobby' && (
        <LobbyScreen
          onEnterGame={() => setView('game')}
          onPlaySolo={() => setView('solo')}
        />
      )}

      {view === 'solo' && (
        <SoloArena onExit={() => setView('lobby')} />
      )}

      {view === 'game' && (
        <GameScreen onExitToLobby={() => setView('lobby')} />
      )}
    </>
  );
}
