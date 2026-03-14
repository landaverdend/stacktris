import { GameState, InputAction, GameEngine } from '@stacktris/shared';
import { Canvases, renderGameState } from '../render/gameState';
import { InputHandler } from './InputHandler';
import { TICK_MS } from './MultiplayerGame';

export interface GameStats {
  score: number;
  lines: number;
  level: number;
}


/**
 * This should really just be a wrapper around the game engine for calling the tick() method.
 * Game engine is responsible for all logic/state management.
 * This class sends input to the game engine and renders the game state
 */
export class SoloGame {
  private gameEngine: GameEngine;

  private inputHandler: InputHandler;
  private rafId = 0;

  private frameCount = 0;
  private lastFrameTime = 0;
  private simTime = 0;

  constructor() {
    this.gameEngine = new GameEngine();
    this.inputHandler = new InputHandler(action => this.onInput(action, performance.now()));
  }

  get state(): GameState {
    return this.gameEngine.getState();
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
          
          this.inputHandler.tick(now);
          this.gameEngine.tick();

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
    this.gameEngine = new GameEngine();
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.inputHandler.detach();
  }


  private render(canvases: Canvases) {
    const state = this.gameEngine.getState();

    // TODO: include solo stats 
    renderGameState(state, canvases);
  }

  onInput(action: InputAction, now: number): void {
    // if (this.game.state.isGameOver) return;
    // this.game = applyInput(this.game, action, now);
  }
}
