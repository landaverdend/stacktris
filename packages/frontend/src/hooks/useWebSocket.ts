import { useEffect, useState } from 'react';
import { ClientMsg, ServerMsg } from '@stacktris/shared';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ── Module-level singleton ────────────────────────────────────────────────────

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

let socket: WebSocket | null = null;
let currentStatus: ConnectionStatus = 'disconnected';

const statusListeners = new Set<(s: ConnectionStatus) => void>();
const messageListeners = new Set<(msg: ServerMsg) => void>();

function setStatus(s: ConnectionStatus) {
  currentStatus = s;
  statusListeners.forEach(fn => fn(s));
}

function getOrConnect(): void {
  if (socket) return;
  setStatus('connecting');
  socket = new WebSocket(WS_URL);
  socket.onopen = () => setStatus('connected');
  socket.onclose = () => { socket = null; setStatus('disconnected'); };
  socket.onerror = () => setStatus('error');
  socket.onmessage = (e: MessageEvent) => {
    try {
      const msg = JSON.parse(e.data as string) as ServerMsg;
      messageListeners.forEach(fn => fn(msg));
    } catch {
      console.error('[useWebSocket] Failed to parse message:', e.data);
    }
  };
}

export function send(msg: ClientMsg): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  } else {
    console.warn('[useWebSocket] send called while not connected');
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocket(onMessage?: (msg: ServerMsg) => void): {
  status: ConnectionStatus;
  send: typeof send;
} {
  const [status, setLocalStatus] = useState<ConnectionStatus>(currentStatus);

  useEffect(() => {
    statusListeners.add(setLocalStatus);
    getOrConnect();
    return () => { statusListeners.delete(setLocalStatus); };
  }, []);

  useEffect(() => {
    if (!onMessage) return;
    messageListeners.add(onMessage);
    return () => { messageListeners.delete(onMessage); };
  }, [onMessage]);

  return { status, send };
}
