import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'http';
import type { ClientMsg, ServerMsg } from '@stacktris/shared';
import { encodeMsg, decodeMsg } from '@stacktris/shared';
import { sessionRegistry } from '../game/sessionRegistry.js';

/** A WebSocket with an attached stable player ID and display name. */
export interface PlayerSocket extends WebSocket {
  playerId: string;
  playerName: string;
  lightningAddress: string;
}


export class WSServer {
  private wss: WebSocketServer;
  private roomRegistry: sessionRegistry;

  constructor(server: Server, roomManager: sessionRegistry) {
    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', this.onConnection.bind(this));
    console.log('[WSServer] attached to HTTP server');

    this.roomRegistry = roomManager;
  }

  private onConnection(ws: WebSocket, _req: IncomingMessage): void {
    const sock = ws as PlayerSocket;
    sock.playerId = crypto.randomUUID();
    sock.playerName = '';
    sock.lightningAddress = '';

    console.log(`[WSServer] connected: ${sock.playerId}`);

    const sendFn = (msg: ServerMsg) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encodeMsg(msg));
      }
    }

    this.roomRegistry.onConnect(sock.playerId, sendFn);

    ws.on('message', (data) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = decodeMsg(new Uint8Array(data as Buffer)) as any;
      if (raw.type === 'set_player_name') {
        sock.playerName = raw.name ?? '';
        sock.lightningAddress = raw.lightning_address ?? '';
        return;
      }
      this.roomRegistry.onMessage(sock.playerId, sock.playerName, sock.lightningAddress, raw as ClientMsg);
    });

    ws.on('close', () => {
      console.log(`[WSServer] disconnected: ${sock.playerId}`);
      this.roomRegistry.onDisconnect(sock.playerId);
    });

    ws.on('error', (err) => {
      console.error(`[WSServer] socket error (${sock.playerId}):`, err.message);
    });
  }
}
