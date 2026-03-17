import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Board, PendingGarbage } from "@stacktris/shared";
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
  const [opponentBoards, setOpponentBoards] = useState<Record<string, Board>>({});
  const [winnerId, setWinnerId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const handleGameStart = (msg: { type: 'game_start'; seed: number }) => {
      const { board, queue, hold } = refs;
      if (!board.current || !queue.current || !hold.current) return;

      setWinnerId(undefined);
      setOpponentBoards({});
      gameSession.current = new NetworkGame(msg.seed, ws);
      unsubGarbage.current = gameSession.current.subscribeGarbage(setPendingGarbage);
      gameSession.current.start({ board: board.current, queue: queue.current, hold: hold.current });
    };

    const handleOpponentBoardUpdate = (msg: { type: 'opponent_board_update'; playerId: string; board: Board }) => {
      setOpponentBoards(prev => ({ ...prev, [msg.playerId]: msg.board }));
    };

    const handleGameOver = (msg: { type: 'game_over'; winnerId: string | null }) => {
      gameSession.current?.stop();
      setWinnerId(msg.winnerId);
    };

    ws.on('game_start', handleGameStart);
    ws.on('opponent_board_update', handleOpponentBoardUpdate);
    ws.on('game_over', handleGameOver);

    return () => {
      ws.off('game_start', handleGameStart);
      ws.off('opponent_board_update', handleOpponentBoardUpdate);
      ws.off('game_over', handleGameOver);
      unsubGarbage.current?.();
      gameSession.current?.stop();
    };
  }, [ws]);

  const getTickCount = useCallback(() => gameSession.current?.currentFrame ?? 0, []);

  return { pendingGarbage, getTickCount, opponentBoards, winnerId };
}
