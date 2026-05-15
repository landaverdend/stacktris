import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ARENA_WIDTH } from '../../components/LocalArena';
import { H_PADDING, ARENA_GAP } from './constants';
import { useSplitSession } from './useSplitSession';
import { SplitControlBar } from './SplitControlBar';
import { SplitLobby } from './SplitLobby';
import { SplitBoards } from './SplitBoards';
import { SplitOverlay } from './SplitOverlay';
import { NervGridOverlay } from '../../components/NervGridOverlay';
import { TelemetryColumns } from '../../components/TelemetryColumns';
import { TimeDangerSignal } from '../../game/TimeDangerSignal';

function useArenaScale(playerCount: number) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function update() {
      const available = window.innerWidth - H_PADDING;
      const natural = playerCount * ARENA_WIDTH + (playerCount - 1) * ARENA_GAP;
      setScale(Math.min(1, available / natural));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [playerCount]);
  return scale;
}

export function SplitScreen() {
  const navigate = useNavigate();
  const session = useSplitSession();
  const { snapshot, resetSession } = session;
  const { status, games } = snapshot;
  const scale = useArenaScale(snapshot.playerCount);

  const timeDangerRef = useRef(new TimeDangerSignal());

  useEffect(() => () => timeDangerRef.current.stop(), []);

  // Reset and start the time signal when a round begins; stop otherwise.
  useEffect(() => {
    const sig = timeDangerRef.current;
    if (status === 'playing') {
      sig.reset();
    } else {
      sig.stop();
    }
  }, [status, snapshot.roundId]);

  return (
    <div className="flex flex-col items-center min-h-screen gap-6 px-8 pt-20">
      <NervGridOverlay dangerSignal={timeDangerRef.current} />
      <TelemetryColumns dangerSignal={timeDangerRef.current} />
      <SplitControlBar session={session} onAbort={() => navigate('/')} />
      {status === 'lobby' && <SplitLobby session={session} scale={scale} />}
      {games.length > 0 && <SplitBoards session={session} scale={scale} />}
      <SplitOverlay
        session={session}
        onPlayAgain={resetSession}
        onMainMenu={() => navigate('/')}
      />
    </div>
  );
}
