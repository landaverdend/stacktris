import { COUNTDOWN_SECONDS, WINS_TO_MATCH } from '@stacktris/shared';
import { LocalGame } from './LocalGame';
import { LocalRound } from './LocalRound';
import { GamepadInputHandler } from './GamepadInputHandler';
import { LocalPlayerConfig, defaultLocalPlayerConfig } from './LocalPlayerConfig';

const INTERMISSION_SECONDS = 5;
const ROUND_WINNER_DISPLAY_SECONDS = 3;

export type LocalMatchStatus = 'lobby' | 'countdown' | 'playing' | 'roundWinner' | 'intermission' | 'finished';

export interface LocalMatchSnapshot {
  status: LocalMatchStatus;
  games: readonly LocalGame[];
  roundId: number;
  wins: Record<string, number>;
  readyState: Record<string, boolean>;
  roundWinnerId: string | null;
  matchWinnerId: string | null;
  countdown: number;
  playerCount: number;
  playerConfigs: readonly LocalPlayerConfig[];
}

export class LocalSession {
  readonly playerCount: number;
  private readonly buyIn: number;

  private _configs: LocalPlayerConfig[];
  private _games: readonly LocalGame[] = [];
  private _roundId = 0;
  private _status: LocalMatchStatus = 'lobby';
  private _wins: Record<string, number>;
  private _readyState: Record<string, boolean>;
  private _roundWinnerId: string | null = null;
  private _matchWinnerId: string | null = null;
  private _countdown = COUNTDOWN_SECONDS;

  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private intermissionInterval: ReturnType<typeof setInterval> | null = null;
  private intermissionTimer: ReturnType<typeof setTimeout> | null = null;
  private roundWinnerTimer: ReturnType<typeof setTimeout> | null = null;

  private listeners = new Set<() => void>();

  constructor(playerCount: number, buyIn = 0) {
    this.playerCount = playerCount;
    this.buyIn = buyIn;

    this._configs = Array.from({ length: playerCount }, (_, i) => {
      const config = defaultLocalPlayerConfig(i, buyIn);
      // Default: player 1 = keyboard, subsequent players = gamepad
      if (i > 0) config.inputFactory = (onAction) => new GamepadInputHandler(onAction);
      return config;
    });

    this._wins = Object.fromEntries(this._configs.map(c => [c.playerId, 0]));
    this._readyState = Object.fromEntries(this._configs.map(c => [c.playerId, false]));
  }

  /** Update any fields on a player's config (lightning address, input factory, etc.). */
  setPlayerConfig(playerId: string, updates: Partial<Omit<LocalPlayerConfig, 'playerId'>>): void {
    const idx = this._configs.findIndex(c => c.playerId === playerId);
    if (idx === -1) return;
    this._configs[idx] = { ...this._configs[idx], ...updates };
    this.notify();
  }

  /** Mark a player as having paid their buy-in. */
  setPlayerPaid(playerId: string): void {
    this.setPlayerConfig(playerId, { paid: true });
    // Re-check ready state in case all were already ready and waiting on payment.
    const allReady = Object.values(this._readyState).every(Boolean);
    const allPaid = this._configs.every(c => c.paid);
    if (allReady && allPaid) this.startCountdown();
  }

  readyUp(playerId: string, ready: boolean): void {
    const config = this._configs.find(c => c.playerId === playerId);
    if (!config?.paid) return;

    this._readyState[playerId] = ready;
    this.notify();

    const allReady = Object.values(this._readyState).every(Boolean);
    const allPaid = this._configs.every(c => c.paid);
    if (allReady && allPaid) this.startCountdown();
  }

  get snapshot(): LocalMatchSnapshot {
    return {
      status: this._status,
      games: this._games,
      roundId: this._roundId,
      wins: { ...this._wins },
      readyState: { ...this._readyState },
      roundWinnerId: this._roundWinnerId,
      matchWinnerId: this._matchWinnerId,
      countdown: this._countdown,
      playerCount: this.playerCount,
      playerConfigs: [...this._configs],
    };
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  destroy(): void {
    this.clearCountdownInterval();
    this.clearIntermissionTimers();
    this.clearRoundWinnerTimer();
    this.listeners.clear();
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private startCountdown(): void {
    const seed = Math.floor(Math.random() * 2 ** 32);
    const gameMap: Record<string, LocalGame> = {};
    const gameList: LocalGame[] = [];

    for (const config of this._configs) {
      const inputOptions = config.inputFactory
        ? undefined
        : { dasMs: config.dasMs, arrMs: config.arrMs };
      const game = new LocalGame(seed, config.inputFactory, inputOptions);
      gameMap[config.playerId] = game;
      gameList.push(game);
    }

    this._games = gameList;
    this._roundId++;
    this._roundWinnerId = null;
    this._status = 'countdown';
    this._countdown = COUNTDOWN_SECONDS;

    const round = new LocalRound(gameMap, seed);

    round.subscribe('gameOver', (winnerId) => {
      this._roundWinnerId = winnerId;

      if (winnerId !== null) {
        this._wins[winnerId] = (this._wins[winnerId] ?? 0) + 1;
        if (this._wins[winnerId] >= WINS_TO_MATCH) {
          this._matchWinnerId = winnerId;
          this._status = 'finished';
          this.notify();
          return;
        }
      }

      this._status = 'roundWinner';
      this.notify();

      this.roundWinnerTimer = setTimeout(() => {
        this.roundWinnerTimer = null;
        this.startIntermission();
      }, ROUND_WINNER_DISPLAY_SECONDS * 1000);
    });

    this.notify();

    this.countdownInterval = setInterval(() => {
      this._countdown--;
      this.notify();
      if (this._countdown <= 0) {
        this.clearCountdownInterval();
        this._status = 'playing';
        this.notify();
      }
    }, 1000);
  }

  private startIntermission(): void {
    this._status = 'intermission';
    this._countdown = INTERMISSION_SECONDS;
    this.notify();

    this.intermissionInterval = setInterval(() => {
      this._countdown--;
      this.notify();
    }, 1000);

    this.intermissionTimer = setTimeout(() => {
      this.clearIntermissionTimers();
      // Reset ready state for next round
      this._readyState = Object.fromEntries(this._configs.map(c => [c.playerId, false]));
      this.startCountdown();
    }, INTERMISSION_SECONDS * 1000);
  }

  private clearCountdownInterval(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private clearRoundWinnerTimer(): void {
    if (this.roundWinnerTimer) {
      clearTimeout(this.roundWinnerTimer);
      this.roundWinnerTimer = null;
    }
  }

  private clearIntermissionTimers(): void {
    if (this.intermissionInterval) {
      clearInterval(this.intermissionInterval);
      this.intermissionInterval = null;
    }
    if (this.intermissionTimer) {
      clearTimeout(this.intermissionTimer);
      this.intermissionTimer = null;
    }
  }
}
