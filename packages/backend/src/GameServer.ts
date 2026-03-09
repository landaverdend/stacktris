import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './RoomManager.js';

export class GameServer {
  private wss: WebSocketServer;
  private manager = new RoomManager();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (socket) => this.onConnect(socket));
  }

  openRooms() {
    return this.manager.openRooms();
  }

  // ── Connection lifecycle ───────────────────────────────────────────────────

  private onConnect(socket: WebSocket): void {
    socket.on('message', (raw) => this.onMessage(socket, raw.toString()));
    socket.on('close', () => this.onDisconnect(socket));
  }

  private onDisconnect(socket: WebSocket): void {
    const result = this.manager.removePlayer(socket);
    if (!result) return;

    const { room } = result;
    const remaining = room.players.find(
      p => p.socket !== socket && p.socket.readyState === WebSocket.OPEN
    );
    if (remaining) {
      this.send(remaining.socket, { type: 'opponent_disconnected' });
    }
  }

  // ── Message routing ────────────────────────────────────────────────────────

  private onMessage(socket: WebSocket, raw: string): void {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(raw); }
    catch { return; }

    switch (msg.type) {
      case 'create_room': return this.handleCreateRoom(socket, msg);
      case 'join_room': return this.handleJoinRoom(socket, msg);
    }
  }

  private handleCreateRoom(socket: WebSocket, msg: Record<string, unknown>): void {
    const betSats = Number(msg.bet_sats ?? 0);
    const room = this.manager.createRoom(socket, betSats);
    this.send(socket, { type: 'room_created', room_id: room.id });
  }

  private handleJoinRoom(socket: WebSocket, msg: Record<string, unknown>): void {
    const roomId = String(msg.room_id ?? '');
    const room = this.manager.joinRoom(socket, roomId);
    if (!room) {
      this.send(socket, { type: 'error', message: 'Room not available' });
      return;
    }
    room.players.forEach(p =>
      this.send(p.socket, { type: 'room_joined', room_id: room.id, player_index: p.index })
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private send(socket: WebSocket, msg: object): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }
}
