import { COLS, EngineEventMap, FRAME_DURATION_MS, GameEngine, GameState, mulberry32 } from '@stacktris/shared';
import { Canvases, renderGameState } from '../render';
import { InputHandler } from './InputHandler';
import { IInputHandler, InputHandlerFactory } from './IInputHandler';
import { BoardShaker } from './BoardShaker';
import { DangerSignal } from './DangerSignal';

export interface GameStats {
  score: number;
  lines: number;
  level: number;
}

export class LocalGame {
  private gameEngine: GameEngine;
  private garbageRng: () => number;
  private inputHandler: IInputHandler;
  private shaker: BoardShaker | null = null;
  private rafId = 0;
  private _paused = false;

  readonly danger = new DangerSignal();

  private _frameCount = 0;
  get frameCount() { return this._frameCount; }

  private lastFrameTime = 0;
  private simTime = 0;

  constructor(seed?: number, inputFactory?: InputHandlerFactory) {
    const effectiveSeed = seed ?? Math.floor(Math.random() * 2 ** 32);
    this.gameEngine = new GameEngine({
      startLevel: 0,
      seed: effectiveSeed,
      gravityMode: seed !== undefined ? 'multiplayer' : 'solo',
    });
    this.garbageRng = mulberry32(effectiveSeed);
    const onAction = (action: Parameters<typeof this.gameEngine.handleInput>[0]) => {
      if (!this._paused) this.gameEngine.handleInput(action);
    };
    this.inputHandler = inputFactory
      ? inputFactory(onAction)
      : new InputHandler(onAction);
  }

  get state(): GameState {
    return this.gameEngine.getState();
  }

  /** Route incoming garbage lines into this game. Returns the gap column chosen. */
  addGarbage(lines: number, frame: number): number {
    const gap = Math.floor(this.garbageRng() * COLS);
    this.gameEngine.addGarbage(lines, frame, gap);
    return gap;
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
      if (!this._paused && this.lastFrameTime > 0) {
        const delta = Math.min(now - this.lastFrameTime, 100);
        this.simTime += delta;

        while (this.simTime >= FRAME_DURATION_MS) {
          this._frameCount++;
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

  pause(): void {
    this._paused = true;
    this.lastFrameTime = 0; // reset so no accumulated delta on resume
    this.simTime = 0;
  }

  resume(): void {
    this._paused = false;
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.inputHandler.detach();
    this.shaker?.destroy();
    this.shaker = null;
  }

  subscribe<K extends keyof EngineEventMap>(event: K, fn: (val: EngineEventMap[K]) => void): () => void {
    return this.gameEngine.subscribe(event, fn);
  }
}
