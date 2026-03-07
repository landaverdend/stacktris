import { useState } from 'react';
import { NavBar } from './components/NavBar';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';

type View = 'lobby' | 'game';

export default function App() {
  const [view, setView] = useState<View>('lobby');

  return (
    <>
      <NavBar />

      {view === 'lobby' && (
        <LobbyScreen onEnterGame={() => setView('game')} />
      )}

      {view === 'game' && (
        <GameScreen onExitToLobby={() => setView('lobby')} />
      )}
    </>
  );
}
