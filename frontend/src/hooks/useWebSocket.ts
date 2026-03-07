import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMessage, ServerMessage } from '../types';

type Status = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useWebSocket(url: string) {
  const [status, setStatus] = useState<Status>('disconnected');
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('error');
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        setLastMessage(msg);
      } catch {
        console.error('Failed to parse WS message', event.data);
      }
    };
  }, [url]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  return { status, lastMessage, connect, send };
}
