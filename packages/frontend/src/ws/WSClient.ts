import type { ClientMsg, ServerMsg } from '@stacktris/shared';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type MsgType = ServerMsg['type'];
type MsgOf<T extends MsgType> = Extract<ServerMsg, { type: T }>;
type Handler<T extends MsgType> = (msg: MsgOf<T>) => void;

export class WSClient {
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private handlers = new Map<string, Set<Handler<any>>>();
  private statusHandlers = new Set<(s: ConnectionStatus) => void>();

  constructor(private readonly url: string) { }

  connect(): void {
    if (this.socket) return;
    this.setStatus('connecting');
    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => this.setStatus('connected');
    this.socket.onclose = () => { this.socket = null; this.setStatus('disconnected'); };
    this.socket.onerror = () => this.setStatus('error');
    this.socket.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string) as ServerMsg;
        this.handlers.get(msg.type)?.forEach(h => h(msg as any));
      } catch {
        console.error('[WSClient] failed to parse message:', e.data);
      }
    };
  }

  send(msg: ClientMsg): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    } else {
      console.warn('[WSClient] send called while not connected');
    }
  }

  on<T extends MsgType>(type: T, handler: Handler<T>): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler as Handler<any>);
  }

  off<T extends MsgType>(type: T, handler: Handler<T>): void {
    this.handlers.get(type)?.delete(handler as Handler<any>);
  }

  onStatus(handler: (s: ConnectionStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(s: ConnectionStatus): void {
    this.status = s;
    this.statusHandlers.forEach(h => h(s));
  }
}
