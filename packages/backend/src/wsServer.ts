import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'http';
import type { ClientMsg, ServerMsg } from '@stacktris/shared';
import { RoomManager } from './RoomManager.js';

/** A WebSocket with an attached stable player ID. */
export interface PlayerSocket extends WebSocket {
  playerId: string;
}

export class WSServer {
  private wss: WebSocketServer;
  private roomManager: RoomManager;

  constructor(server: Server, roomManager: RoomManager) {
    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', this.onConnection.bind(this));
    console.log('[WSServer] attached to HTTP server');

    this.roomManager = roomManager;
  }

  private onConnection(ws: WebSocket, _req: IncomingMessage): void {
    const sock = ws as PlayerSocket;
    sock.playerId = crypto.randomUUID();

    console.log(`[WSServer] connected: ${sock.playerId}`);

    ws.on('message', (data) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(data.toString()) as ClientMsg;
      } catch {
        this.send(sock, { type: 'error', message: 'invalid json' });
        return;
      }
      this.onMessage(sock, msg);
    });

    ws.on('close', () => {
      console.log(`[WSServer] disconnected: ${sock.playerId}`);
      this.onDisconnect(sock);
    });

    ws.on('error', (err) => {
      console.error(`[WSServer] socket error (${sock.playerId}):`, err.message);
    });
  }

  private onMessage(_sock: PlayerSocket, _msg: ClientMsg): void {
    this.roomManager.onMessage(_sock, _msg);
  }

  private onDisconnect(_sock: PlayerSocket): void {
    // TODO: notify RoomManager
    this.roomManager.onDisconnect(_sock);
  }

  send(ws: WebSocket, msg: ServerMsg): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
