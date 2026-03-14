import { GameEngine, GameState } from '@stacktris/shared';
import { Canvases, renderGameState } from '../render';
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
    this.gameEngine = new GameEngine({
      onLinesCleared: (lines: number) => {
        console.log('lines cleared ' + lines);
      }
    });

    this.inputHandler = new InputHandler(action => {
      this.gameEngine.handleInput(action);
    });
  }

  get state(): GameState {
    return this.gameEngine.getState();
  }

  start(canvases: Canvases): void {
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

      renderGameState(this.gameEngine.getState(), canvases);
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
}
