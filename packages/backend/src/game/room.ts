import { ClientMsg, COUNTDOWN_SECONDS, PlayerInfo, RoomInfo, RoomStatus, WINS_TO_MATCH } from "@stacktris/shared";
import { GameSession } from "./gameSession.js";
import { PlayerSlot, SendFn } from "../types.js";
import { PaymentService } from "../lightning/paymentService.js";

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

  private buyIn: number;

  private players: Map<string, PlayerSlot> = new Map();
  private wins: Map<string, number> = new Map();

  private matchWinnerId: string | null = null;
  private fsm = new RoomStateMachine();

  private countdownTimer: NodeJS.Timeout | null = null;
  private readonly COUNTDOWN_DURATION = COUNTDOWN_SECONDS * 1000;
  private game: GameSession | null = null;

  private _isSessionStarted = false; // Whether or not the game has started, independent of the room status. Enabled on first match start.

  constructor(id: string, buyIn: number, private readonly paymentService: PaymentService) {
    this.id = id;
    this.buyIn = buyIn;
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
      buyIn: this.buyIn,
      createdAt: this.createdAt,
    };
  }

  public addPlayer(playerId: string, playerName: string, lightningAddress: string, sendFn: SendFn) {
    if (this.isFull) throw new Error(`Room ${this.id} is already full`);
    if (this.status !== 'waiting') throw new Error(`Room ${this.id} is not accepting players`);

    console.log(`[Room] added player ${playerId} (${playerName}) to room ${this.id}`);
    this.players.set(playerId, { playerId, playerName, lightningAddress, sendFn, ready: false, paid: this.buyIn === 0 });
    this.wins.set(playerId, 0);

    if (this.buyIn > 0) {
      this.paymentService.generateBetInvoice(playerId, lightningAddress, sendFn, () => this.onPaymentConfirmed(playerId));
    }

    this.broadcastRoomStateUpdate();
  }

  public removePlayer(playerId: string) {
    console.log(`[Room] removed player ${playerId} from room ${this.id}`);
    this.players.delete(playerId);

    if (this.status === 'countdown') this.cancelCountdown();
    if (this.status === 'playing') this.game?.removePlayer(playerId);

    if (this.buyIn > 0) {
      if (!this._isSessionStarted) {
        // Session hasn't started yet — refund the player's hold.
        this.paymentService.cancelHoldInvoice(playerId);
        console.log(`[Room] refunded hold invoice for player ${playerId} in room ${this.id}`);
      }
      // If the session has started, the hold is forfeited on disconnect.
      this.paymentService.settleHoldInvoice(playerId);
    }

    if (this.isEmpty) this.paymentService.destroy();

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

    // Gate player from readying up until payment is confirmed.
    if (!player || !player.paid) return;


    if (player) player.ready = ready;

    if (this.status === 'waiting' && this.checkAllReady()) {
      this.startCountdown();
    } else if (this.status === 'countdown') {
      this.cancelCountdown();
    }

    this.broadcastRoomStateUpdate();
  }

  private onPaymentConfirmed(playerId: string) {
    console.log(`[Room] payment confirmed for player ${playerId} in room ${this.id}`);
    this.players.get(playerId)!.paid = true;
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
        this.paymentService.onMatchComplete(winnerId);
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
      .map(p => ({ playerId: p.playerId, playerName: p.playerName, ready: p.ready, paid: p.paid, wins: this.wins.get(p.playerId) ?? 0 }));

    this.players.forEach(player => {
      player.sendFn({ type: 'room_state_update', roomState: { players: playerInfoArray, roomId: this.id, status: this.status, matchWinnerId: this.matchWinnerId, buyIn: this.buyIn } });
    });
  }
}
