import { ClientMsg, COUNTDOWN_SECONDS, InputBuffer, PlayerInfo, RoomInfo, SessionStatus, WINS_TO_MATCH } from "@stacktris/shared";
import { Round } from "./round.js";
import { PlayerSlot, SendFn } from "../types.js";
import { PaymentService } from "../lightning/paymentService.js";

// Valid state transitions for a room.
const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  waiting: ['countdown'],
  countdown: ['waiting', 'playing'],
  playing: ['finished'],
  intermission: ['countdown', 'finished'],
  finished: [],
};

class RoomStateMachine {
  private _status: SessionStatus = 'waiting';
  private listeners: Map<SessionStatus, Array<() => void>> = new Map();

  init(): void {
    this.listeners.get(this._status)?.forEach(fn => fn());
  }
  get status(): SessionStatus { return this._status; }

  transition(to: SessionStatus): void {
    if (!VALID_TRANSITIONS[this._status].includes(to)) {
      throw new Error(`Invalid room transition: ${this._status} → ${to}`);
    }
    this._status = to;
    this.listeners.get(to)?.forEach(fn => fn());
  }

  on(status: SessionStatus, fn: () => void): void {
    if (!this.listeners.has(status)) this.listeners.set(status, []);
    this.listeners.get(status)!.push(fn);
  }
}

export const MAX_PLAYERS = 8;

export class Session {
  private id: string;
  private createdAt: number = Date.now();

  private buyIn: number;

  private players: Map<string, PlayerSlot> = new Map();
  private wins: Map<string, number> = new Map();

  private matchWinnerId: string | null = null;
  private roundWinnerId: string | null = null;

  private fsm = new RoomStateMachine();

  private countdownTimer: NodeJS.Timeout | null = null;
  private readonly COUNTDOWN_DURATION = COUNTDOWN_SECONDS * 1000;
  private round: Round | null = null;

  private _isSessionStarted = false;

  constructor(id: string, buyIn: number, private readonly paymentService: PaymentService) {
    this.id = id;
    this.buyIn = buyIn;

    this.fsm.on('waiting', () => {
      console.log(`[Session] waiting`);
    })
    this.fsm.on('countdown', () => {
      console.log(`[Session] countdown`);
    })
    this.fsm.on('playing', () => {
      console.log(`[Session] playing`);
    })
    this.fsm.on('finished', () => {
      console.log(`[Session] finished`);
    })

    this.fsm.init();
  }

  get status(): SessionStatus { return this.fsm.status; }
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
    this.players.delete(playerId);

    const hasBuyIn = this.buyIn > 0;

    // If the session hasn't started and we have the hold invoice, cancel it.
    if (!this._isSessionStarted) {

      // If we have a buy in, cancel the hold invoice.
      if (hasBuyIn) this.paymentService.cancelHoldInvoice(playerId);

      // Also, if we haven't started the session and we're the last player, cancel the countdown.
      if (this.playerCount === 1) this.cancelCountdown();

    } else {
      // If the player is removed after the session has officially started, settle the hold invoice.
      if (hasBuyIn) this.paymentService.settleHoldInvoice(playerId);

      // TODO: check if the player is the last one in the session, if so, declare them the winner and handle the session completion??

    }

    this.broadcastRoomStateUpdate();
  }


  public onMessage(playerId: string, msg: ClientMsg) {
    switch (msg.type) {
      case 'ready_update':
        this.onReadyUpdate(playerId, msg.ready);
        break;
      default:
        this.round?.onMessage(playerId, msg);
        break;
    }
  }

  private onReadyUpdate(playerId: string, ready: boolean) {
    // Once a session is underway, ready state is irrelevant — rounds auto-restart.
    if (this._isSessionStarted) return;

    const player = this.players.get(playerId);
    if (!player || !player.paid) return;

    player.ready = ready;

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
    this.broadcastRoomStateUpdate();
  }

  private cancelCountdown() {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = null;
    this.fsm.transition('waiting');
  }

  private startGame() {
    this._isSessionStarted = true;

    this.fsm.transition('playing');
    this.round = new Round(Array.from(this.players.values()));
    this.round.subscribe('gameOver', (winnerId) => this.onRoundEnd(winnerId));
    this.broadcastRoomStateUpdate();
  }

  private onRoundEnd(winnerId: string | null) {
    this.round = null;

    // If a winner was determined, update win counts and check if the session is complete
    if (winnerId) {
      const w = (this.wins.get(winnerId) ?? 0) + 1;
      this.wins.set(winnerId, w);
      if (w >= WINS_TO_MATCH) {
        // this.matchWinnerId = winnerId;
        // this.paymentService.onMatchComplete(winnerId);
        this.handleSessionCompletion(winnerId);
      }
    }

    this.broadcastRoomStateUpdate();
  }

  private broadcastRoomStateUpdate() {
    const playerInfoArray: PlayerInfo[] = Array.from(this.players.values())
      .map(p => ({ playerId: p.playerId, playerName: p.playerName, ready: p.ready, paid: p.paid, wins: this.wins.get(p.playerId) ?? 0 }));

    this.players.forEach(player => {
      player.sendFn({ type: 'session_state_update', roomState: { players: playerInfoArray, roomId: this.id, status: this.status, matchWinnerId: this.matchWinnerId, buyIn: this.buyIn } });
    });
  }

  private handleSessionCompletion(winnerId: string) {

  }

}
