import { SendFn } from "./WSServer.js";

interface PlayerSlot {
  playerId: string;
  sendFn: SendFn; // Closure reference to the send function for this player.
}

export class Room {
  private id: string;

  private players: Map<string, PlayerSlot> = new Map();

  constructor(id: string) {
    this.id = id;
  }

  addPlayer(playerId: string, sendFn: SendFn) {
    console.log(`[Room] added player ${playerId} to room ${this.id}`);
    this.players.set(playerId, { playerId, sendFn });
  }

  removePlayer(playerId: string) {
    console.log(`[Room] removed player ${playerId} from room ${this.id}`);
    this.players.delete(playerId);
  }

}