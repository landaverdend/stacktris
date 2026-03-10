import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { InputAction } from '@stacktris/shared';
import { RoomManager, Room } from './RoomManager.js';
import { GameSession } from './GameSession.js';

export class GameServer {
  private wss: WebSocketServer;
  private manager = new RoomManager();
  private sessions = new Map<string, GameSession>(); // room id → session

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
      case 'player_ready': return this.handlePlayerReady(socket, msg);
      case 'game_action': return this.handleGameAction(socket, msg);
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
    // Tell each player their index
    room.players.forEach(p =>
      this.send(p.socket, { type: 'room_joined', room_id: room.id, player_index: p.index })
    );
    // Broadcast initial ready state (both not ready)
    this.broadcastReadyUpdate(room);
  }

  private handleGameAction(socket: WebSocket, msg: Record<string, unknown>): void {
    const room = this.manager.roomOf(socket);
    if (!room) return;
    const session = this.sessions.get(room.id);
    session?.onInput(socket, msg.action as InputAction);
  }

  private handlePlayerReady(socket: WebSocket, msg: Record<string, unknown>): void {
    const ready = Boolean(msg.ready);
    const result = this.manager.setReady(socket, ready);
    if (!result) return;

    const { room, allReady } = result;
    this.broadcastReadyUpdate(room);

    if (allReady) {
      this.manager.startRoom(room.id);
      this.sessions.set(room.id, new GameSession(room.players));
      room.players.forEach(p =>
        this.send(p.socket, { type: 'game_start', countdown: 3 })
      );
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private broadcastReadyUpdate(room: Room): void {
    const players = room.players.map(p => ({ index: p.index, ready: p.ready }));
    room.players.forEach(p =>
      this.send(p.socket, { type: 'ready_update', players })
    );
  }

  private send(socket: WebSocket, msg: object): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }
}
