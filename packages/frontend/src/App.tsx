import { Routes, Route } from 'react-router-dom';
import { WSProvider } from './ws/WSContext';
import { RoomProvider } from './context/RoomContext';
import { NavBar } from './components/NavBar';
import { TitleScreen } from './screens/TitleScreen';
import { MultiplayerScreen } from './screens/multiplayerScreen/MultiplayerScreen';
import { SoloScreen } from './screens/SoloScreen';
import { TetrominoBackground } from './components/TetrominoBackground';
import { NameEntryScreen } from './screens/NameEntryScreen';
import { useConnection } from './ws/WSContext';

function AppInner() {
  const { playerName } = useConnection();
  const showNameEntry = playerName === null;

  return (
    <>
      {showNameEntry && <NameEntryScreen />}
      <TetrominoBackground />
      <div className="relative" style={{ zIndex: 1 }}>
        <NavBar />
        <Routes>
          <Route path="/" element={<TitleScreen />} />
          <Route path="/solo" element={<SoloScreen />} />
          <Route path="/room/:roomId" element={<MultiplayerScreen />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <WSProvider>
      <RoomProvider>
        <AppInner />
      </RoomProvider>
    </WSProvider>
  );
}
