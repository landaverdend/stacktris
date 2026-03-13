import { GameState, GameContext, createGame, applyInput, levelFromLines, InputAction, applyGravity } from '@stacktris/shared';
import { Canvases, renderGameState } from '../render/gameState';
import { InputHandler } from './InputHandler';
import { TICK_MS } from './MultiplayerGame';


export interface GameStats {
  score: number;
  lines: number;
  level: number;
}

export class SoloGame {
  private game: GameContext;

  private inputHandler: InputHandler;
  private rafId = 0;

  private frameCount = 0;
  private lastFrameTime = 0;
  private simTime = 0;

  constructor() {
    this.game = createGame({ levelStrategy: levelFromLines });
    this.inputHandler = new InputHandler(action => this.onInput(action, performance.now()));
  }

  get state(): GameState {
    return this.game.state;
  }

  start(canvases: Canvases): void {
    this.reset();
    this.inputHandler.attach();

    const loop = (now: number) => {
      if (this.lastFrameTime > 0) {
        const delta = Math.min(now - this.lastFrameTime, 100);
        this.simTime += delta;

        while (this.simTime >= TICK_MS) {
          this.frameCount++;
          // console.log(`frame ${this.frameCount}`);
          this.inputHandler.tick(now);
          this.tick();

          this.simTime -= TICK_MS;
        }
      }

      this.render(canvases);
      this.lastFrameTime = now;
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  reset(): void {
    this.game = createGame({ levelStrategy: levelFromLines });
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.inputHandler.detach();
  }

  tick(): void {
    if (this.game.state.isGameOver) return;

    this.game = applyGravity(this.game);
  }

  private render(canvases: Canvases) {
    const state = this.game.state;

    // TODO: include solo stats 
    renderGameState(state, canvases);
  }

  onInput(action: InputAction, now: number): void {
    if (this.game.state.isGameOver) return;
    this.game = applyInput(this.game, action, now);
  }
}
