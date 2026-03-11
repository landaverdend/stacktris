import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'http';
import type { ClientMsg, ServerMsg } from '@stacktris/shared';
import { RoomRegistry } from './roomRegistry.js';

/** A WebSocket with an attached stable player ID. */
export interface PlayerSocket extends WebSocket {
  playerId: string;
}


export class WSServer {
  private wss: WebSocketServer;
  private roomRegistry: RoomRegistry;

  constructor(server: Server, roomManager: RoomRegistry) {
    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', this.onConnection.bind(this));
    console.log('[WSServer] attached to HTTP server');

    this.roomRegistry = roomManager;
  }

  /**
   * On connection, assign a player ID and register the player in the room registry alongside their send function.
   * @param ws 
   * @param _req 
   */
  private onConnection(ws: WebSocket, _req: IncomingMessage): void {
    const sock = ws as PlayerSocket;
    sock.playerId = crypto.randomUUID();

    console.log(`[WSServer] connected: ${sock.playerId}`);

    const sendFn = (msg: ServerMsg) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }

    this.roomRegistry.onConnect(sock.playerId, sendFn);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as ClientMsg;
      // Route directly to the room registry
      this.roomRegistry.onMessage(sock.playerId, msg);
    });

    ws.on('close', () => {
      console.log(`[WSServer] disconnected: ${sock.playerId}`);
      this.roomRegistry.onDisconnect(sock.playerId);
    });

    ws.on('error', (err) => {
      console.error(`[WSServer] socket error (${sock.playerId}):`, err.message);
    });
  }


  send(ws: WebSocket, msg: ServerMsg): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
