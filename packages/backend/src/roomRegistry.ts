import { ClientMsg, ServerMsg } from "@stacktris/shared";
import { Room } from "./room.js";
import { SendFn } from "./WSServer.js";


export class RoomRegistry {

  // Map of player ID to send function
  private playerIdToSendFn = new Map<string, SendFn>();

  // Map of room ID to room
  private rooms: Map<string, Room> = new Map();
  private playerIdToRoom = new Map<string, string>();

  constructor() {
  }


  public onConnect(playerId: string, sendFn: SendFn) {
    this.playerIdToSendFn.set(playerId, sendFn);
  }

  public onMessage(playerId: string, msg: ClientMsg): void {
    console.log('[RoomManager] onMessage: ', msg);

    switch (msg.type) {
      case 'create_room':
        console.log('[RoomManager] create_room: ', msg);
        this.createRoom(playerId);
        break;
      case 'join_room':
        console.log('[RoomManager] join_room: ', msg);
        this.joinRoom(playerId, msg.room_id);
        break;
      default:
        const roomId = this.playerIdToRoom.get(playerId);
        const room = this.rooms.get(this.playerIdToRoom.get(playerId)!)
        console.log('[RoomManager] onMessage: ', room);
        break;
    }

  }

  private createRoom(playerId: string): void {
    const roomId = crypto.randomUUID();
    const room = new Room(roomId);

    this.rooms.set(roomId, room);
    room.addPlayer(playerId, this.playerIdToSendFn.get(playerId)!);
    this.playerIdToRoom.set(playerId, roomId);
  }


  private joinRoom(playerId: string, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.addPlayer(playerId, this.playerIdToSendFn.get(playerId)!);
    }
  }

  public onDisconnect(playerId: string): void {
    const roomId = this.playerIdToRoom.get(playerId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      room?.removePlayer(playerId);
      this.playerIdToRoom.delete(playerId);
    }
  }
}