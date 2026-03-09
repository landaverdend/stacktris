import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoomPlayer {
  socket: WebSocket;
  index: 0 | 1;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  betSats: number;
  createdAt: number;  // unix seconds
  status: RoomStatus;
  players: [RoomPlayer] | [RoomPlayer, RoomPlayer];
}

// ── RoomManager ───────────────────────────────────────────────────────────────

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketRoom = new Map<WebSocket, string>();

  createRoom(socket: WebSocket, betSats: number): Room {
    const room: Room = {
      id: randomUUID(),
      betSats,
      createdAt: Math.floor(Date.now() / 1000),
      status: 'waiting',
      players: [{ socket, index: 0 }],
    };
    this.rooms.set(room.id, room);
    this.socketRoom.set(socket, room.id);
    return room;
  }

  /** Returns the room if the join succeeded, null otherwise. */
  joinRoom(socket: WebSocket, roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'waiting' || room.players.length >= 2) return null;

    (room.players as RoomPlayer[]).push({ socket, index: 1 });
    (room as { status: RoomStatus }).status = 'playing';
    this.socketRoom.set(socket, room.id);
    return room;
  }

  /** Returns the room and the leaving player, if found. */
  removePlayer(socket: WebSocket): { room: Room; player: RoomPlayer } | null {
    const roomId = this.socketRoom.get(socket);
    this.socketRoom.delete(socket);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = room.players.find(p => p.socket === socket);
    if (!player) return null;

    if (room.players.length === 1 || room.status === 'waiting') {
      // Creator left before anyone joined — remove the room entirely
      this.rooms.delete(room.id);
    } else {
      (room as { status: RoomStatus }).status = 'finished';
    }

    return { room, player };
  }

  finishRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) (room as { status: RoomStatus }).status = 'finished';
    // Clean up after clients have time to receive final messages
    setTimeout(() => this.rooms.delete(roomId), 10_000);
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  roomOf(socket: WebSocket): Room | undefined {
    const id = this.socketRoom.get(socket);
    return id ? this.rooms.get(id) : undefined;
  }

  openRooms(): { id: string; bet_sats: number; created_at: number }[] {
    return [...this.rooms.values()]
      .filter(r => r.status === 'waiting')
      .map(r => ({ id: r.id, bet_sats: r.betSats, created_at: r.createdAt }));
  }
}
