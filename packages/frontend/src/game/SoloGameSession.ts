import { SoloGame } from './SoloGame';
import { InputHandler } from './InputHandler';
import { renderGameState, Canvases } from '../render/gameState';

export type { Canvases };

export interface GameStats {
  score: number;
  lines: number;
  level: number;
}

export class SoloGameSession {
  private game = new SoloGame();
  private input: InputHandler;
  private rafId = 0;

  private onStatUpdate: (stats: GameStats) => void;
  private lastStats: GameStats = { score: -1, lines: -1, level: -1 };

  constructor(onStatUpdate: (stats: GameStats) => void) {
    this.onStatUpdate = onStatUpdate;
    this.input = new InputHandler(action => this.game.input(action, performance.now()));
  }

  start(canvases: Canvases): void {
    this.game.reset();
    this.input.attach();

    const loop = (now: number) => {
      this.input.tick(now);
      this.game.tick(now);
      this.render(canvases, now);
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.input.detach();
  }

  private render(canvases: Canvases, now: number): void {
    const state = this.game.state;

    if (this.haveStatsChanged()) {
      const stats = { score: state.score, lines: state.lines, level: state.level };
      this.lastStats = stats;
      this.onStatUpdate(stats);
    }

    renderGameState(state, canvases, now);
  }

  private haveStatsChanged() {
    const state = this.game.state;
    return state.score !== this.lastStats.score || state.lines !== this.lastStats.lines || state.level !== this.lastStats.level;
  }

}
