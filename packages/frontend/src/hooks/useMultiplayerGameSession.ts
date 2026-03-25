import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { ActivePiece, Board, GameSnapshot, InputBuffer, PendingGarbage, SessionState } from "@stacktris/shared";
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
  const opponentActivePieces = useRef<Map<string, ActivePiece | null>>(new Map());

  const unsubGarbage = useRef<(() => void) | null>(null);
  const unsubGameOver = useRef<(() => void) | null>(null);

  const pendingGarbageRef = useRef<PendingGarbage[]>([]);
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
      setDeadPlayers(new Set());
      setIsClientAlive(true);
      pendingGarbageRef.current = [];

      opponentActivePieces.current.clear();

      console.log(`Starting game with seed ${msg.seed}`);
      gameSession.current = new NetworkGame(msg.seed, ws);

      unsubGarbage.current = gameSession.current.subscribe('pendingGarbage', (val) => { pendingGarbageRef.current = val; });
      unsubGameOver.current = gameSession.current.subscribe('gameOver', () => setIsClientAlive(false));

      gameSession.current.start({ board: board.current, queue: queue.current, hold: hold.current });
    };

    const handleOpponentBoardUpdate = (msg: { type: 'opponent_board_update'; playerId: string; board: Board }) => {
      opponentActivePieces.current.set(msg.playerId, null);
      setOpponentBoards(prev => ({ ...prev, [msg.playerId]: msg.board }));
    };

    const handleOpponentPieceUpdate = (msg: { playerId: string; activePiece: ActivePiece | null }) => {
      opponentActivePieces.current.set(msg.playerId, msg.activePiece);
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

    ws.on('game_start', handleGameStart);
    ws.on('opponent_board_update', handleOpponentBoardUpdate);
    ws.on('opponent_piece_update', handleOpponentPieceUpdate);
    ws.on('game_player_died', handleDeadPlayer);
    ws.on('session_state_update', handleGameOver);

    return () => {
      ws.off('game_start', handleGameStart);
      ws.off('opponent_board_update', handleOpponentBoardUpdate);
      ws.off('opponent_piece_update', handleOpponentPieceUpdate);
      ws.off('session_state_update', handleGameOver);
      ws.off('game_player_died', handleDeadPlayer);

      unsubGarbage.current?.();
      unsubGameOver.current?.();
      gameSession.current?.stop();
    };
  }, [ws]);

  const getTickCount = useCallback(() => gameSession.current?.currentFrame ?? 0, []);

  return { pendingGarbageRef, getTickCount, opponentBoards, opponentActivePieces, winnerId: roundWinnerId, deadPlayers, isClientAlive };
}
