import { Emitter } from './emitter.js';

export interface IRoundPlayer {
  addGarbage(lines: number, frame: number): number;
  readonly frameCount: number;
  subscribe(event: 'attack', fn: (lines: number) => void): () => void;
  subscribe(event: 'gameOver', fn: () => void): () => void;
}

export abstract class RoundBase<P extends IRoundPlayer> {
  readonly seed: number;
  readonly playerOrder: readonly string[];
  protected readonly alivePlayers: Set<string>;
  private readonly targetIndices: Record<string, number> = {};
  private _gameEnded = false;

  get gameEnded() { return this._gameEnded; }

  private emitter = new Emitter<{ gameOver: string | null }>();
  subscribe = this.emitter.subscribe.bind(this.emitter);

  constructor(protected readonly players: Record<string, P>, seed: number) {
    this.seed = seed;
    this.playerOrder = Object.keys(players);
    this.alivePlayers = new Set(this.playerOrder);
    for (let i = 0; i < this.playerOrder.length; i++) {
      this.targetIndices[this.playerOrder[i]] = (i + 1) % this.playerOrder.length;
    }
    for (const [id, player] of Object.entries(players)) {
      player.subscribe('attack', (lines) => this.routeGarbage(id, lines, player.frameCount));
      player.subscribe('gameOver', () => this.killPlayer(id));
    }
  }

  private routeGarbage(attackerId: string, lines: number, triggerFrame: number): void {
    const targetId = this.advanceTarget(attackerId);
    if (!targetId) return;
    const gap = this.players[targetId].addGarbage(lines, triggerFrame);
    this.onRouteGarbage(attackerId, targetId, lines, triggerFrame, gap);
  }

  private advanceTarget(attackerId: string): string | null {
    const n = this.playerOrder.length;
    let idx = this.targetIndices[attackerId];
    for (let i = 0; i < n; i++) {
      const candidate = this.playerOrder[idx];
      idx = (idx + 1) % n;
      if (candidate !== attackerId && this.alivePlayers.has(candidate)) {
        this.targetIndices[attackerId] = idx;
        return candidate;
      }
    }
    return null;
  }

  killPlayer(playerId: string): void {
    if (this._gameEnded || !this.alivePlayers.has(playerId)) return;
    this.alivePlayers.delete(playerId);
    delete this.targetIndices[playerId];
    this.onKillPlayer(playerId);
    if (this.alivePlayers.size <= 1) {
      this._gameEnded = true;
      const winnerId = [...this.alivePlayers][0] ?? null;
      this.emitter.emit('gameOver', winnerId);
      this.onGameOver(winnerId);
    }
  }

  protected abstract onKillPlayer(playerId: string): void;
  protected abstract onGameOver(winnerId: string | null): void;
  protected abstract onRouteGarbage(attackerId: string, targetId: string, lines: number, frame: number, gap: number): void;
}
