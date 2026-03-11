import { ClientMsg, PlayerInfo, RoomInfo, RoomStatus } from "@stacktris/shared";
import { SendFn } from "./wsServer.js";

interface PlayerSlot {
  playerId: string;
  sendFn: SendFn; // Closure reference to the send function for this player.

  ready: boolean;
}

export const MAX_PLAYERS = 2;

export class Room {
  private id: string;
  private createdAt: number = Date.now();

  private betSats: number;
  private players: Map<string, PlayerSlot> = new Map();

  private status: RoomStatus = "waiting";

  constructor(id: string, betSats: number) {
    this.id = id;
    this.betSats = betSats;
  }

  get playerCount() { return this.players.size; }

  get isFull() { return this.players.size >= MAX_PLAYERS; }

  get isEmpty() { return this.players.size === 0; }

  get roomInfo(): RoomInfo {
    return {
      roomId: this.id,
      playerCount: this.playerCount,
      betSats: this.betSats,
      createdAt: this.createdAt,
    };
  }

  public addPlayer(playerId: string, sendFn: SendFn) {
    if (this.isFull) throw new Error(`Room ${this.id} is already full`);

    console.log(`[Room] added player ${playerId} to room ${this.id}`);
    this.players.set(playerId, { playerId, sendFn, ready: false });

    this.broadcastRoomStateUpdate();
  }

  public removePlayer(playerId: string) {
    console.log(`[Room] removed player ${playerId} from room ${this.id}`);
    this.players.delete(playerId);

    this.broadcastRoomStateUpdate();
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
    const player = this.players.get(playerId);
    if (player) {
      player.ready = ready;
    }

    // broadcast updated ready state to all players.
    this.broadcastRoomStateUpdate();
  }

  private broadcastRoomStateUpdate() {
    const playerInfoArray: PlayerInfo[] = Array.from(this.players.values())
      .map(p => ({ playerId: p.playerId, ready: p.ready }));

    this.players.forEach(player => {
      player.sendFn({ type: 'room_state_update', roomState: { players: playerInfoArray, roomId: this.id, status: this.status } });
    });
  }

  private tickInterval() {
  }

}