import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Board, InputBuffer, PendingGarbage, SessionState } from "@stacktris/shared";
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
  const [roundWinnerId, setRoundWinnerId] = useState<string | null | undefined>(undefined);
  const [sessionWinnerId, setSessionWinnerId] = useState<string | null>(null);

  const [isClientAlive, setIsClientAlive] = useState(true);

  useEffect(() => {
    const handleGameStart = (msg: { type: 'game_start'; seed: number }) => {
      const { board, queue, hold } = refs;
      if (!board.current || !queue.current || !hold.current) return;

      setRoundWinnerId(undefined);
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

    const handleGameOver = (msg: { type: 'session_state_update'; roomState: SessionState }) => {
      if (msg.roomState.status === 'intermission') {
        gameSession.current?.stop();
        setRoundWinnerId(msg.roomState.roundWinnerId);
      } else if (msg.roomState.status === 'finished') {
        gameSession.current?.stop();
        setSessionWinnerId(msg.roomState.matchWinnerId);
      }


    };

    const handleDeadPlayer = ({ playerId }: { playerId: string }) => {
      setDeadPlayers(prev => new Set(prev).add(playerId));
    };


    const handleGamePlayerInput = ({ playerId, inputBuffer }: { type: 'game_player_input'; playerId: string; inputBuffer: InputBuffer }) => {
      console.log('[game_player_input]', playerId, inputBuffer);
    };

    ws.on('game_start', handleGameStart);
    ws.on('opponent_board_update', handleOpponentBoardUpdate);
    ws.on('game_player_died', handleDeadPlayer);
    ws.on('session_state_update', handleGameOver);
    ws.on('game_player_input', handleGamePlayerInput);

    return () => {
      ws.off('game_start', handleGameStart);
      ws.off('opponent_board_update', handleOpponentBoardUpdate);
      ws.off('session_state_update', handleGameOver);
      ws.off('game_player_died', handleDeadPlayer)
      ws.off('game_player_input', handleGamePlayerInput);

      unsubGarbage.current?.();
      unsubGameOver.current?.();
      gameSession.current?.stop();
    };
  }, [ws]);

  const getTickCount = useCallback(() => gameSession.current?.currentFrame ?? 0, []);

  return { pendingGarbage, getTickCount, opponentBoards, winnerId: roundWinnerId, deadPlayers, isClientAlive };
}
