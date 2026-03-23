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
  const unsubGameOver = useRef<(() => void) | null>(null);

  const [pendingGarbage, setPendingGarbage] = useState<PendingGarbage[]>([]);
  const [opponentBoards, setOpponentBoards] = useState<Record<string, Board>>({});
  const [deadPlayers, setDeadPlayers] = useState<Set<string>>(new Set());
  const [winnerId, setWinnerId] = useState<string | null | undefined>(undefined);
  const [isClientAlive, setIsClientAlive] = useState(true);

  useEffect(() => {
    const handleGameStart = (msg: { type: 'game_start'; seed: number }) => {
      const { board, queue, hold } = refs;
      if (!board.current || !queue.current || !hold.current) return;

      setWinnerId(undefined);
      setOpponentBoards({});
      setDeadPlayers(new Set())
      setIsClientAlive(true);

      gameSession.current = new NetworkGame(msg.seed, ws);
      unsubGarbage.current = gameSession.current.subscribe('pendingGarbage', (val) => setPendingGarbage(val));
      unsubGameOver.current = gameSession.current.subscribe('gameOver', () => setIsClientAlive(false));

      gameSession.current.start({ board: board.current, queue: queue.current, hold: hold.current });
    };

    const handleOpponentBoardUpdate = (msg: { type: 'opponent_board_update'; playerId: string; board: Board }) => {
      setOpponentBoards(prev => ({ ...prev, [msg.playerId]: msg.board }));
    };

    const handleGameOver = (msg: { type: 'game_over'; winnerId: string | null }) => {
      gameSession.current?.stop();
      setWinnerId(msg.winnerId);
    };

    const handleDeadPlayer = ({ playerId }: { playerId: string }) => {
      setDeadPlayers(prev => new Set(prev).add(playerId));
    };

    ws.on('game_start', handleGameStart);
    ws.on('opponent_board_update', handleOpponentBoardUpdate);
    ws.on('game_player_died', handleDeadPlayer);
    ws.on('game_over', handleGameOver);

    return () => {
      ws.off('game_start', handleGameStart);
      ws.off('opponent_board_update', handleOpponentBoardUpdate);
      ws.off('game_over', handleGameOver);
      ws.off('game_player_died', handleDeadPlayer)

      unsubGarbage.current?.();
      unsubGameOver.current?.();
      gameSession.current?.stop();
    };
  }, [ws]);

  const getTickCount = useCallback(() => gameSession.current?.currentFrame ?? 0, []);

  return { pendingGarbage, getTickCount, opponentBoards, winnerId, deadPlayers, isClientAlive };
}
