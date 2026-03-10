import { ClientMsg, ServerMsg } from "@stacktris/shared";
import { Room } from "./room.js";
import { SendFn } from "./wsServer.js";


export class RoomRegistry {

  // Map of player ID to send function
  private playerIdToSendFn = new Map<string, SendFn>();

  // Map of room ID to room
  private rooms: Map<string, Room> = new Map();
  private playerIdToRoom = new Map<string, string>();

  constructor() {
  }

  get roomCount() { return this.rooms.size; }
  roomForPlayer(playerId: string) { return this.playerIdToRoom.get(playerId); }

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
      case 'leave_room':
        console.log('[RoomManager] leave_room: ', msg);
        this.leaveRoom(playerId);
        break;
      default:
        const roomId = this.playerIdToRoom.get(playerId);
        const room = this.rooms.get(this.playerIdToRoom.get(playerId)!)
        if (room) {
          room.onMessage(playerId, msg);
        }
        break;
    }

  }

  private createRoom(playerId: string): void {
    const roomId = crypto.randomUUID();
    const room = new Room(roomId);

    this.rooms.set(roomId, room);
    room.addPlayer(playerId, this.playerIdToSendFn.get(playerId)!);
    this.playerIdToRoom.set(playerId, roomId);

    // Ping back to the player with the room status and id.
    this.playerIdToSendFn.get(playerId)!({ type: 'room_created', room_id: roomId });
  }


  private joinRoom(playerId: string, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.addPlayer(playerId, this.playerIdToSendFn.get(playerId)!);
      this.playerIdToRoom.set(playerId, roomId);
    }
  }

  private leaveRoom(playerId: string) {
    const roomId = this.playerIdToRoom.get(playerId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      room?.removePlayer(playerId);
      this.playerIdToRoom.delete(playerId);
    }
  }

  public onDisconnect(playerId: string): void {
    const roomId = this.playerIdToRoom.get(playerId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      room?.removePlayer(playerId);
      this.playerIdToRoom.delete(playerId);

      if (room?.isEmpty) {
        this.rooms.delete(roomId);
      }
    }
  }
}