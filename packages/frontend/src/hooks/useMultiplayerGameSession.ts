import { useEffect, useRef } from "react";
import { useWS } from "../ws/WSContext";
import { MultiplayerGameSession } from "../game/MultiplayerGameSession";


export function useMultiplayerGameSession() {
  const ws = useWS();

  const gameSession = useRef<MultiplayerGameSession | null>(null);

  useEffect(() => {
    ws.on('game_start', (msg: { type: 'game_start'; seed: number }) => {
      gameSession.current = new MultiplayerGameSession(() => { }, msg.seed);
    })
  }, [ws])

  return { gameSession: gameSession.current };
}