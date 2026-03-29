import { EngineEventMap, FRAME_DURATION_MS, GameEngine, GameState } from '@stacktris/shared';
import { Canvases, renderGameState } from '../render';
import { InputHandler } from './InputHandler';
import { BoardShaker } from './BoardShaker';
import { DangerSignal } from './DangerSignal';

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
export class LocalGame {
  private gameEngine: GameEngine;

  private inputHandler: InputHandler;
  private shaker: BoardShaker | null = null;
  private rafId = 0;

  readonly danger = new DangerSignal();

  private frameCount = 0;
  private lastFrameTime = 0;
  private simTime = 0;

  constructor() {
    this.gameEngine = new GameEngine({ startLevel: 0 });

    this.inputHandler = new InputHandler(action => {
      this.gameEngine.handleInput(action);
    });
  }

  get state(): GameState {
    return this.gameEngine.getState();
  }

  start(canvases: Canvases, boardWrapper: HTMLElement): void {
    this.shaker = new BoardShaker(boardWrapper);

    this.gameEngine.subscribe('hardDrop', (rows) => {
      this.shaker?.onHardDrop(rows);
    });
    this.gameEngine.subscribe('pieceLocked', ({ linesCleared }) => {
      this.shaker?.onLinesCleared(linesCleared);
    });

    this.inputHandler.attach();

    const loop = (now: number) => {
      if (this.lastFrameTime > 0) {
        const delta = Math.min(now - this.lastFrameTime, 100);
        this.simTime += delta;

        while (this.simTime >= FRAME_DURATION_MS) {
          this.frameCount++;
          this.inputHandler.tick(now);
          this.gameEngine.tick();
          this.simTime -= FRAME_DURATION_MS;
        }
      }

      const state = this.gameEngine.getState();
      renderGameState(state, canvases);
      this.danger.update(state.board);
      this.shaker?.tick();
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
    this.shaker?.destroy();
    this.shaker = null;
  }

  // Wrapper...
  subscribe(event: keyof EngineEventMap, fn: (event: EngineEventMap[keyof EngineEventMap]) => void): () => void {
    return this.gameEngine.subscribe(event, fn);
  }
}
