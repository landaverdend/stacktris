import { ClientMessage, GameAction, OpponentSnapshot, PlayerSnapshot, ServerMessage } from '../types';

// ── State types ───────────────────────────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type GameStatus =
  | { status: 'lobby' }
  | { status: 'waiting_payment'; roomId: string }
  | { status: 'waiting_opponent'; roomId: string }
  | { status: 'playing'; roomId: string; your: PlayerSnapshot; opponent: OpponentSnapshot }
  | { status: 'result'; winnerId: string; yourScore: number; opponentScore: number };

export interface GameClientState {
  connection: ConnectionStatus;
  gameStatus: GameStatus;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

let instance: GameClient | null = null;

export function getGameClient(): GameClient {
  if (!instance) instance = new GameClient(WS_URL);
  return instance;
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class GameClient {
  private ws: WebSocket | null = null;
  private subscribers = new Set<(state: GameClientState) => void>();

  private state: GameClientState = {
    connection: 'disconnected',
    gameStatus: { status: 'lobby' },
  };

  constructor(private readonly url: string) { }

  // ── Subscription ────────────────────────────────────────────────────────────

  subscribe(fn: (state: GameClientState) => void): () => void {
    this.subscribers.add(fn);
    fn(this.state); // seed with current state immediately
    return () => this.subscribers.delete(fn);
  }

  getState(): GameClientState {
    return this.state;
  }

  private setState(patch: Partial<GameClientState>): void {
    this.state = { ...this.state, ...patch };
    this.subscribers.forEach(fn => fn(this.state));
  }

  private setStatus(gameStatus: GameStatus): void {
    this.setState({ gameStatus });
  }

  // ── Connection ──────────────────────────────────────────────────────────────

  connect(): void {
    if (this.ws) return;
    this.setState({ connection: 'connecting' });

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => this.setState({ connection: 'connected' });
    ws.onclose = () => { this.ws = null; this.setState({ connection: 'disconnected' }); };
    ws.onerror = () => this.setState({ connection: 'error' });
    ws.onmessage = (e: MessageEvent) => this.onMessage(e);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  // ── Inbound message handling ────────────────────────────────────────────────

  private onMessage(event: MessageEvent): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data as string) as ServerMessage;
    } catch {
      console.error('[GameClient] Failed to parse message:', event.data);
      return;
    }

    switch (msg.type) {
      case 'room_created':
        this.setStatus({ status: 'waiting_payment', roomId: msg.room_id });
        break;

      case 'room_joined':
        this.setStatus({ status: 'waiting_payment', roomId: msg.room_id });
        break;

      case 'player_joined':
        // Second player joined our room — stay on waiting_payment until game_start
        break;

      case 'game_start': {
        const s = this.state.gameStatus;
        if (s.status === 'waiting_payment' || s.status === 'waiting_opponent') {
          this.setStatus({ status: 'waiting_opponent', roomId: s.roomId });
        }
        break;
      }

      case 'game_state': {
        const s = this.state.gameStatus;
        const roomId = 'roomId' in s ? s.roomId : '';
        this.setStatus({ status: 'playing', roomId, your: msg.your, opponent: msg.opponent });
        break;
      }

      case 'piece_moved': {
        const s = this.state.gameStatus;
        if (s.status !== 'playing') break;
        // Only the active piece positions changed — board is untouched.
        this.setStatus({
          ...s,
          your: { ...s.your, current_piece: msg.your_piece },
        });
        break;
      }

      case 'hold_update': {
        const s = this.state.gameStatus;
        if (s.status !== 'playing') break;
        this.setStatus({
          ...s,
          your: {
            ...s.your,
            hold_piece: msg.hold_piece,
            hold_used: true,
            current_piece: msg.your_piece,
            next_pieces: msg.next_pieces,
          },
        });
        break;
      }

      case 'game_over':
        this.setStatus({
          status: 'result',
          winnerId: msg.winner_id,
          yourScore: msg.your_score,
          opponentScore: msg.opponent_score,
        });
        break;

      case 'error':
        console.error('[GameClient] Server error:', msg.message);
        break;
    }
  }

  // ── Outbound actions ────────────────────────────────────────────────────────

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('[GameClient] send called while not connected');
    }
  }

  createRoom(betSats: number): void {
    this.send({ type: 'create_room', bet_sats: betSats });
  }

  joinRoom(roomId: string, betSats: number): void {
    this.send({ type: 'join_room', room_id: roomId, bet_sats: betSats });
  }

  sendAction(action: GameAction): void {
    this.send({ type: 'game_action', action });
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  goToLobby(): void {
    this.setStatus({ status: 'lobby' });
  }
}
