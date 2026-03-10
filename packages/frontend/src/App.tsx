import { useState } from 'react';
import { RoomProvider } from './context/RoomContext';
import { NavBar } from './components/NavBar';
import { LobbyScreen } from './screens/LobbyScreen';
import { MultiplayerScreen } from './screens/MultiplayerScreen';
import { SoloScreen } from './screens/SoloScreen';
import { LightningGraph } from './components/LightningGraph';
import { TetrominoBackground } from './components/TetrominoBackground';
import { GlitchOverlay } from './components/GlitchOverlay';
import { GenesisBlock } from './components/GenesisBlock';

type View = 'lobby' | 'multiplayer' | 'solo';

export default function App() {
  const [view, setView] = useState<View>('lobby');

  return (
    <RoomProvider>
      {view === 'lobby' && <LightningGraph />}
      <TetrominoBackground />
      {view === 'lobby' && <GlitchOverlay />}
      {view === 'lobby' && <GenesisBlock />}
      <div className="relative" style={{ zIndex: 1 }}>
        <NavBar />

        {view === 'lobby' && (
          <LobbyScreen onEnterGame={() => setView('multiplayer')} onEnterSolo={() => setView('solo')} />
        )}

        {view === 'multiplayer' && (
          <MultiplayerScreen onExitToLobby={() => setView('lobby')} />
        )}

        {view === 'solo' && (
          <SoloScreen onExit={() => setView('lobby')} />
        )}
      </div>
    </RoomProvider>
  );
}
