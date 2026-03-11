import { ClientMsg, COUNTDOWN_SECONDS, PlayerInfo, RoomInfo, RoomStatus } from "@stacktris/shared";
import { GameSession } from "./game.js";
import { PlayerSlot, SendFn } from "./types.js";

// Valid state transitions for a room.
const VALID_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  waiting: ['countdown'],
  countdown: ['waiting', 'playing'],
  playing: ['finished'],
  finished: [],
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

export const MAX_PLAYERS = 2;

export class Room {
  private id: string;
  private createdAt: number = Date.now();
  private betSats: number;
  private players: Map<string, PlayerSlot> = new Map();

  private fsm = new RoomStateMachine();
  private countdownTimer: NodeJS.Timeout | null = null;
  private readonly COUNTDOWN_DURATION = COUNTDOWN_SECONDS * 1000;
  private game: GameSession | null = null;

  constructor(id: string, betSats: number) {
    this.id = id;
    this.betSats = betSats;
  }

  get status(): RoomStatus { return this.fsm.status; }
  get playerCount() { return this.players.size; }
  get isFull() { return this.players.size >= MAX_PLAYERS; }
  get isEmpty() { return this.players.size === 0; }

  get roomInfo(): RoomInfo {
    return {
      roomId: this.id,
      playerCount: this.playerCount,
      betSats: this.betSats,
      createdAt: this.createdAt,
    };
  }

  public addPlayer(playerId: string, sendFn: SendFn) {
    if (this.isFull) throw new Error(`Room ${this.id} is already full`);
    if (this.status !== 'waiting') throw new Error(`Room ${this.id} is not accepting players`);

    console.log(`[Room] added player ${playerId} to room ${this.id}`);
    this.players.set(playerId, { playerId, sendFn, ready: false });
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
    console.log(`[Room] onMessage: ${msg.type} from player ${playerId} in room ${this.id}`);

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

    if (this.checkAllReady()) {
      this.startCountdown();
    } else if (this.status === 'countdown') {
      this.cancelCountdown();
    }

    this.broadcastRoomStateUpdate();
  }

  private checkAllReady() {
    return this.playerCount >= 2 && Array.from(this.players.values()).every(p => p.ready);
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
    this.fsm.transition('playing');
    this.game = new GameSession(
      Array.from(this.players.values()),
      (winnerId) => this.onGameEnd(winnerId),
    );
    this.broadcastRoomStateUpdate();
  }

  private onGameEnd(winnerId: string) {
    this.fsm.transition('finished');
    this.game = null;
    console.log(`[Room] game over in room ${this.id}, winner: ${winnerId}`);
    this.broadcastRoomStateUpdate();
  }

  private broadcastRoomStateUpdate() {
    const playerInfoArray: PlayerInfo[] = Array.from(this.players.values())
      .map(p => ({ playerId: p.playerId, ready: p.ready }));

    this.players.forEach(player => {
      player.sendFn({ type: 'room_state_update', roomState: { players: playerInfoArray, roomId: this.id, status: this.status } });
    });
  }
}
