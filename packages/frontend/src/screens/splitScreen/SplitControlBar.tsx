import { SplitSessionState } from './useSplitSession';
import { MAX_PLAYERS } from './constants';

type Props = {
  session: SplitSessionState;
  onAbort: () => void;
};

export function SplitControlBar({ session, onAbort }: Props) {
  const { buyIn, inputBuyIn, potSats, aliveCount, snapshot, handleBuyInInput, addPlayer, removePlayer } = session;
  const { status, playerCount } = snapshot;

  const labelCls = 'font-display font-bold text-2xl tracking-[0.02em]';

  return (
    <div className="flex items-stretch h-11 border border-phosphor/35 bg-black/50 divide-x divide-phosphor/35 w-fit">
      {/* Buy-in input (lobby only) */}
      {status === 'lobby' && (
        <div className="flex items-center gap-3 px-5">
          <span className={`${labelCls} text-phosphor/40`}>BUY IN</span>
          <input
            type="number"
            min={0}
            value={inputBuyIn}
            onChange={(e) => handleBuyInInput(Math.max(0, Number(e.target.value)))}
            className="w-24 bg-transparent text-bitcoin font-segment text-4xl text-right outline-none leading-none"
          />
          <span className={`${labelCls} text-bitcoin/35`}>SATS</span>
        </div>
      )}

      {/* Pot display during active game */}
      {buyIn > 0 && status !== 'lobby' && (
        <div className="flex items-center gap-3 px-5">
          <span className={`${labelCls} text-phosphor/40`}>POT</span>
          <span className="font-segment text-xl text-bitcoin">{potSats}</span>
          <span className={`${labelCls} text-bitcoin/35`}>SATS</span>
        </div>
      )}

      {/* Alive count */}
      {status === 'playing' && (
        <div className="flex items-center px-5">
          <span className={`${labelCls} text-teal/60`}>{aliveCount} ALIVE</span>
        </div>
      )}

      {/* Add player */}
      {status === 'lobby' && playerCount < MAX_PLAYERS && (
        <button
          onClick={addPlayer}
          className={`px-5 ${labelCls} text-teal/60 hover:text-teal hover:bg-teal/5 transition-all cursor-pointer`}>
          + ADD PLAYER
        </button>
      )}

      {/* Remove player */}
      {status === 'lobby' && playerCount > 2 && (
        <button
          onClick={removePlayer}
          className={`px-5 ${labelCls} text-alert/50 hover:text-alert hover:bg-alert/5 transition-all cursor-pointer`}>
          − REMOVE
        </button>
      )}

      {/* Abort */}
      {status !== 'finished' && (
        <button
          onClick={onAbort}
          className={`px-5 ${labelCls} text-phosphor/30 hover:text-alert hover:bg-alert/5 transition-all cursor-pointer`}>
          ABORT
        </button>
      )}
    </div>
  );
}
