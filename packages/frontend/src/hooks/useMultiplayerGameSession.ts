import { RefObject, useEffect, useRef, useState } from "react";
import { PendingGarbage } from "@stacktris/shared";
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
  const unsubGarbage = useRef<(() => void) | null>(null);
  const [pendingGarbage, setPendingGarbage] = useState<PendingGarbage[]>([]);

  useEffect(() => {
    const handleGameStart = (msg: { type: 'game_start'; seed: number }) => {
      const { board, queue, hold } = refs;
      if (!board.current || !queue.current || !hold.current) return;

      gameSession.current = new NetworkGame(msg.seed, ws);
      unsubGarbage.current = gameSession.current.subscribeGarbage(setPendingGarbage);
      gameSession.current.start({ board: board.current, queue: queue.current, hold: hold.current });
    };

    ws.on('game_start', handleGameStart);

    return () => {
      ws.off('game_start', handleGameStart);
      unsubGarbage.current?.();
      gameSession.current?.stop();
    };
  }, [ws]);

  return { pendingGarbage };
}
