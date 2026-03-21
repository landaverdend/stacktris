import { ClientMsg, RoomInfo } from '@stacktris/shared';
import { MAX_PLAYERS, Room } from './room.js';
import { SendFn } from '../types.js';
import { PaymentClient } from '../lightning/paymentClient.js';
import { PaymentService } from '../lightning/paymentService.js';

export class RoomRegistry {
  // Map of player ID to send function
  private playerIdToSendFn = new Map<string, SendFn>();

  // Map of room ID to room
  private rooms: Map<string, Room> = new Map();
  private playerIdToRoom = new Map<string, string>();

  constructor(private readonly paymentClient: PaymentClient) { }

  get roomCount() {
    return this.rooms.size;
  }
  roomForPlayer(playerId: string) {
    return this.playerIdToRoom.get(playerId);
  }

  public onConnect(playerId: string, sendFn: SendFn) {
    this.playerIdToSendFn.set(playerId, sendFn);
    sendFn({ type: 'welcome', player_id: playerId });
  }

  public onMessage(playerId: string, playerName: string, lightningAddress: string, msg: ClientMsg): void {
    switch (msg.type) {
      case 'create_room':
        console.log('[RoomManager] create_room: ', msg);
        this.createRoom(playerId, playerName, lightningAddress, msg.buy_in);
        break;
      case 'join_room':
        console.log('[RoomManager] join_room: ', msg);
        this.joinRoom(playerId, playerName, lightningAddress, msg.room_id);
        break;
      case 'leave_room':
        console.log('[RoomManager] leave_room: ', msg);
        this.leaveRoom(playerId);
        break;

      /// All other cases should be routed directly to the room.
      default:
        const room = this.rooms.get(this.playerIdToRoom.get(playerId)!);
        if (room) {
          room.onMessage(playerId, msg);
        }
        break;
    }
  }

  private createRoom(playerId: string, playerName: string, lightningAddress: string, buyIn: number): void {
    const roomId = crypto.randomUUID();
    const paymentService = new PaymentService(this.paymentClient, buyIn);
    const room = new Room(roomId, buyIn, paymentService);

    this.rooms.set(roomId, room);
    room.addPlayer(playerId, playerName, lightningAddress, this.playerIdToSendFn.get(playerId)!);
    this.playerIdToRoom.set(playerId, roomId);

    // Ping back to the player with the room status and id.
    this.playerIdToSendFn.get(playerId)!({ type: 'room_created', room_id: roomId });
  }

  private joinRoom(playerId: string, playerName: string, lightningAddress: string, roomId: string): void {
    try {
      const room = this.rooms.get(roomId);
      if (room) {
        room.addPlayer(playerId, playerName, lightningAddress, this.playerIdToSendFn.get(playerId)!);
        this.playerIdToRoom.set(playerId, roomId);
      }
    } catch (error) {
      console.error(`[RoomRegistry] failed to join room ${roomId}`);
      this.playerIdToSendFn.get(playerId)!({ type: 'error', message: 'Failed to join room' });
    }
  }

  private leaveRoom(playerId: string) {
    const roomId = this.playerIdToRoom.get(playerId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      room?.removePlayer(playerId);
      this.playerIdToRoom.delete(playerId);

      // Delete if empty.
      if (room?.isEmpty) {
        this.rooms.delete(roomId);
      }
    }
  }

  public onDisconnect(playerId: string): void {
    const roomId = this.playerIdToRoom.get(playerId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      room?.removePlayer(playerId);
      this.playerIdToRoom.delete(playerId);

      // Delete if empty.
      if (room?.isEmpty) {
        this.rooms.delete(roomId);
      }
    }
  }

  /**
   * Don't show rooms that:
   * - Are in progress
   * - Are full
   * @returns List of rooms that are waiting to start a new match.
   */
  public listRooms(): RoomInfo[] {
    return Array.from(this.rooms.values())
      .filter((room) => room.playerCount < MAX_PLAYERS && !room.isSessionStarted)
      .map((room) => room.roomInfo);
  }
}
