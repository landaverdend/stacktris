import { RefObject, useEffect, useRef } from "react";
import { useWS } from "../ws/WSContext";
import { MultiplayerGameSession } from "../game/MultiplayerGameSession";

type CanvasRefs = {
  board: RefObject<HTMLCanvasElement | null>;
  queue: RefObject<HTMLCanvasElement | null>;
  hold: RefObject<HTMLCanvasElement | null>;
}

export function useMultiplayerGameSession(refs: CanvasRefs) {
  const ws = useWS();
  const gameSession = useRef<MultiplayerGameSession | null>(null);

  useEffect(() => {
    const handler = (msg: { type: 'game_start'; seed: number }) => {
      const { board, queue, hold } = refs;
      if (!board.current || !queue.current || !hold.current) return;

      gameSession.current = new MultiplayerGameSession(msg.seed, ws);
      gameSession.current.start({ board: board.current, queue: queue.current, hold: hold.current });
    };

    ws.on('game_start', handler);

    return () => {
      ws.off('game_start', handler);
      gameSession.current?.stop();
    };
  }, [ws]);
}
