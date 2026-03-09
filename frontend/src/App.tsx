import { useState } from 'react';
import { NavBar } from './components/NavBar';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { TetrominoBackground } from './components/TetrominoBackground';

type View = 'lobby' | 'game';

export default function App() {
  const [view, setView] = useState<View>('lobby');

  return (
    <>
      <TetrominoBackground />
      <div className="relative" style={{ zIndex: 1 }}>
        <NavBar />

        {view === 'lobby' && (
          <LobbyScreen onEnterGame={() => setView('game')} />
        )}

        {view === 'game' && (
          <GameScreen onExitToLobby={() => setView('lobby')} />
        )}
      </div>
    </>
  );
}
