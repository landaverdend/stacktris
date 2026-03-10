import { ClientMsg } from "@stacktris/shared";
import { SendFn } from "./wsServer.js";

interface PlayerSlot {
  playerId: string;
  sendFn: SendFn; // Closure reference to the send function for this player.
}

export const MAX_PLAYERS = 2;


export class Room {
  private id: string;

  private players: Map<string, PlayerSlot> = new Map();

  constructor(id: string) {
    this.id = id;
  }

  get playerCount() { return this.players.size; }

  get isFull() { return this.players.size >= MAX_PLAYERS; }

  get isEmpty() { return this.players.size === 0; }

  public addPlayer(playerId: string, sendFn: SendFn) {
    if (this.isFull) throw new Error(`Room ${this.id} is already full`);

    console.log(`[Room] added player ${playerId} to room ${this.id}`);
    this.players.set(playerId, { playerId, sendFn });
  }

  public removePlayer(playerId: string) {
    console.log(`[Room] removed player ${playerId} from room ${this.id}`);
    this.players.delete(playerId);
  }

  public onMessage(playerId: string, msg: ClientMsg) {
    console.log(`[Room] onMessage: ${msg.type} from player ${playerId} in room ${this.id}`);

    switch (msg.type) {
      case 'ready_update':
        this.onReadyUpdate(playerId, msg.ready)
        break;
    }
  }

  private onReadyUpdate(playerId: string, ready: boolean) {
  }
}