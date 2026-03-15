import { RefObject, useEffect, useRef } from "react";
import { useWS } from "../ws/WSContext";
import { NetworkGame } from "../game/NetworkGame";

type CanvasRefs = {
  board: RefObject<HTMLCanvasElement | null>;
  queue: RefObject<HTMLCanvasElement | null>;
  hold: RefObject<HTMLCanvasElement | null>;
}

export function useMultiplayerGameSession(refs: CanvasRefs) {
  const ws = useWS();
  const gameSession = useRef<NetworkGame | null>(null);

  useEffect(() => {
    const handleGameStart = (msg: { type: 'game_start'; seed: number }) => {
      const { board, queue, hold } = refs;
      if (!board.current || !queue.current || !hold.current) return;

      gameSession.current = new NetworkGame(msg.seed, ws);
      gameSession.current.start({ board: board.current, queue: queue.current, hold: hold.current });
    };

    ws.on('game_start', handleGameStart);

    return () => {
      ws.off('game_start', handleGameStart);
      gameSession.current?.stop();
    };
  }, [ws]);
}
