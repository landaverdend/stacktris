import { useState } from 'react';
import { NavBar } from './components/NavBar';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { LightningGraph } from './components/LightningGraph';
import { TetrominoBackground } from './components/TetrominoBackground';
import { GlitchOverlay } from './components/GlitchOverlay';
import { GenesisBlock } from './components/GenesisBlock';

type View = 'lobby' | 'game';

export default function App() {
  const [view, setView] = useState<View>('lobby');

  return (
    <>
      {view === 'lobby' && <LightningGraph />}
      {view === 'lobby' && <TetrominoBackground />}
      {view === 'lobby' && <GlitchOverlay />}
      {view === 'lobby' && <GenesisBlock />}
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
