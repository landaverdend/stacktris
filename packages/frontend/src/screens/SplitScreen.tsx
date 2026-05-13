import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LocalArena, ARENA_WIDTH } from '../components/LocalArena';

interface SplitSessionState {
  buyIn: number;
}

const MAX_PLAYERS = 100;
const GAP = 24; // px between arenas
const H_PADDING = 64; // total horizontal padding

function useArenaScale(playerCount: number) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function update() {
      const available = window.innerWidth - H_PADDING;
      const natural = playerCount * ARENA_WIDTH + (playerCount - 1) * GAP;
      setScale(Math.min(1, available / natural));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [playerCount]);

  return scale;
}

export function SplitScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { buyIn } = (state as SplitSessionState) ?? { buyIn: 0 };
  const [playerCount, setPlayerCount] = useState(2);
  const scale = useArenaScale(playerCount);

  return (
    <div className="flex flex-col items-center min-h-screen gap-6 px-8 pt-20">
      <div className="flex items-center gap-6">
        {buyIn > 0 && (
          <span className="font-mono text-sm text-bitcoin tracking-widest">
            BUY IN: {buyIn} SATS
          </span>
        )}
        {playerCount < MAX_PLAYERS && (
          <button
            onClick={() => setPlayerCount(n => n + 1)}
            className="font-display font-bold text-xl tracking-[0.02em] text-phosphor/40 hover:text-teal transition-colors cursor-pointer border border-[rgba(0,255,180,0.2)] hover:border-teal px-4 py-1">
            + ADD PLAYER
          </button>
        )}
        <button
          onClick={() => navigate('/')}
          className="font-display font-bold text-xl tracking-[0.02em] text-phosphor/30 hover:text-alert transition-colors cursor-pointer">
          ABORT
        </button>
      </div>

      <div className="flex items-start justify-center gap-2" style={{ gap: GAP * scale }}>
        {Array.from({ length: playerCount }, (_, i) => (
          <LocalArena key={i} playerLabel={`P${i + 1}`} scale={scale} />
        ))}
      </div>
    </div>
  );
}
