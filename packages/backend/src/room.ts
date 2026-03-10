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

  get playerCount() { return this.players.size; }
  get isFull() { return this.players.size >= 2; }
  get isEmpty() { return this.players.size === 0; }

  addPlayer(playerId: string, sendFn: SendFn) {
    if (this.isFull) throw new Error(`Room ${this.id} is already full`);

    console.log(`[Room] added player ${playerId} to room ${this.id}`);
    this.players.set(playerId, { playerId, sendFn });
  }

  removePlayer(playerId: string) {
    console.log(`[Room] removed player ${playerId} from room ${this.id}`);
    this.players.delete(playerId);
  }

}