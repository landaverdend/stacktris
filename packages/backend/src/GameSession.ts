import { WebSocket } from 'ws';
import { InputAction } from '@stacktris/shared';
import { RoomPlayer } from './RoomManager.js';

export class GameSession {
  private players: RoomPlayer[];

  constructor(players: RoomPlayer[]) {
    this.players = players;
    console.log(`[GameSession] started for players ${players[0].index} and ${players[1].index}`);
  }

  onInput(socket: WebSocket, action: InputAction): void {
    const player = this.players.find(p => p.socket === socket);
    if (!player) return;
    console.log(`[GameSession] player ${player.index} → ${action}`);
  }

  onPlayerDisconnect(socket: WebSocket): void {
    const player = this.players.find(p => p.socket === socket);
    if (!player) return;
    console.log(`[GameSession] player ${player.index} disconnected`);
  }
}
