import { ClientMsg, COUNTDOWN_SECONDS, PlayerInfo, RoomInfo, RoomStatus, WINS_TO_MATCH } from "@stacktris/shared";
import { GameSession } from "./gameSession.js";
import { PlayerSlot, SendFn } from "./types.js";

// Valid state transitions for a room.
const VALID_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  waiting: ['countdown'],
  countdown: ['waiting', 'playing'],
  playing: ['finished'],
  finished: ['waiting'],
};

class RoomStateMachine {
  private _status: RoomStatus = 'waiting';

  get status(): RoomStatus { return this._status; }

  transition(to: RoomStatus): void {
    if (!VALID_TRANSITIONS[this._status].includes(to)) {
      throw new Error(`Invalid room transition: ${this._status} → ${to}`);
    }
    this._status = to;
  }
}

export const MAX_PLAYERS = 8;

export class Room {
  private id: string;
  private createdAt: number = Date.now();

  private betSats: number;

  private players: Map<string, PlayerSlot> = new Map();
  private wins: Map<string, number> = new Map();

  private matchWinnerId: string | null = null;
  private fsm = new RoomStateMachine();

  private countdownTimer: NodeJS.Timeout | null = null;
  private readonly COUNTDOWN_DURATION = COUNTDOWN_SECONDS * 1000;
  private game: GameSession | null = null;

  private _isSessionStarted = false; // Whether or not the game has started, independent of the room status. Enabled on first match start.

  constructor(id: string, betSats: number) {
    this.id = id;
    this.betSats = betSats;
  }

  get status(): RoomStatus { return this.fsm.status; }
  get playerCount() { return this.players.size; }
  get isFull() { return this.players.size >= MAX_PLAYERS; }
  get isEmpty() { return this.players.size === 0; }
  get isSessionStarted() { return this._isSessionStarted; }

  get roomInfo(): RoomInfo {
    return {
      roomId: this.id,
      playerCount: this.playerCount,
      betSats: this.betSats,
      createdAt: this.createdAt,
    };
  }

  public addPlayer(playerId: string, playerName: string, sendFn: SendFn) {
    if (this.isFull) throw new Error(`Room ${this.id} is already full`);
    if (this.status !== 'waiting') throw new Error(`Room ${this.id} is not accepting players`);

    console.log(`[Room] added player ${playerId} (${playerName}) to room ${this.id}`);
    this.players.set(playerId, { playerId, playerName, sendFn, ready: false });
    this.wins.set(playerId, 0);
    this.broadcastRoomStateUpdate();
  }

  public removePlayer(playerId: string) {
    console.log(`[Room] removed player ${playerId} from room ${this.id}`);
    this.players.delete(playerId);

    if (this.status === 'countdown') this.cancelCountdown();
    if (this.status === 'playing') { this.game?.destroy(); this.game = null; }

    this.broadcastRoomStateUpdate();
  }

  public onMessage(playerId: string, msg: ClientMsg) {
    switch (msg.type) {
      case 'ready_update':
        this.onReadyUpdate(playerId, msg.ready);
        break;
      default:
        this.game?.onMessage(playerId, msg);
        break;
    }
  }

  private onReadyUpdate(playerId: string, ready: boolean) {
    const player = this.players.get(playerId);
    if (player) player.ready = ready;

    if (this.status === 'waiting' && this.checkAllReady()) {
      this.startCountdown();
    } else if (this.status === 'countdown') {
      this.cancelCountdown();
    }

    this.broadcastRoomStateUpdate();
  }

  private checkAllReady() {
    return this.playerCount >= 2 && this.playerCount <= MAX_PLAYERS && Array.from(this.players.values()).every(p => p.ready);
  }

  private startCountdown() {
    this.fsm.transition('countdown');
    this.countdownTimer = setTimeout(() => this.startGame(), this.COUNTDOWN_DURATION);
  }

  private cancelCountdown() {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = null;
    this.fsm.transition('waiting');
  }

  private startGame() {
    this._isSessionStarted = true;
    this.fsm.transition('playing');
    this.game = new GameSession(Array.from(this.players.values()));
    this.game.subscribe('gameOver', (winnerId) => this.onGameEnd(winnerId));
    this.broadcastRoomStateUpdate();
  }

  private onGameEnd(winnerId: string | null) {
    this.fsm.transition('finished');
    this.game = null;

    if (winnerId) {
      const w = (this.wins.get(winnerId) ?? 0) + 1;
      this.wins.set(winnerId, w);
      if (w >= WINS_TO_MATCH) {
        this.matchWinnerId = winnerId;
      }
    }

    console.log(`[Room] round over in room ${this.id}, winner: ${winnerId ?? 'draw'}, match winner: ${this.matchWinnerId ?? 'none'}`);
    this.broadcastRoomStateUpdate();

    // If match is still going, reset to waiting after a short delay so players can ready up again.
    if (!this.matchWinnerId) {
      setTimeout(() => {
        this.players.forEach(p => { p.ready = false; });
        this.fsm.transition('waiting');
        this.broadcastRoomStateUpdate();
      }, 3000);
    }
  }

  private broadcastRoomStateUpdate() {
    const playerInfoArray: PlayerInfo[] = Array.from(this.players.values())
      .map(p => ({ playerId: p.playerId, playerName: p.playerName, ready: p.ready, wins: this.wins.get(p.playerId) ?? 0 }));

    this.players.forEach(player => {
      player.sendFn({ type: 'room_state_update', roomState: { players: playerInfoArray, roomId: this.id, status: this.status, matchWinnerId: this.matchWinnerId } });
    });
  }
}
