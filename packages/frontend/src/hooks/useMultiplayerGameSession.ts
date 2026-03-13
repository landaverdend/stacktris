import { RefObject, useEffect, useRef } from "react";
import { useWS } from "../ws/WSContext";
import { MultiplayerGameSession } from "../game/MultiplayerGameSession";
import { GameSnapshot } from "@stacktris/shared";

type CanvasRefs = {
  board: RefObject<HTMLCanvasElement | null>;
  queue: RefObject<HTMLCanvasElement | null>;
  hold: RefObject<HTMLCanvasElement | null>;
}

export function useMultiplayerGameSession(refs: CanvasRefs) {
  const ws = useWS();
  const gameSession = useRef<MultiplayerGameSession | null>(null);

  useEffect(() => {
    const handleGameStart = (msg: { type: 'game_start'; seed: number }) => {
      const { board, queue, hold } = refs;
      if (!board.current || !queue.current || !hold.current) return;

      gameSession.current = new MultiplayerGameSession(msg.seed, ws);
      gameSession.current.start({ board: board.current, queue: queue.current, hold: hold.current });
    };


    const handleGameSnapshot = (msg: { type: 'game_snapshot'; snapshot: GameSnapshot }) => {
      console.log('game snapshot', msg.snapshot);
    };

    ws.on('game_start', handleGameStart);
    ws.on('game_snapshot', handleGameSnapshot);

    return () => {
      ws.off('game_start', handleGameStart);
      ws.off('game_snapshot', handleGameSnapshot);
      gameSession.current?.stop();
    };
  }, [ws]);
}
