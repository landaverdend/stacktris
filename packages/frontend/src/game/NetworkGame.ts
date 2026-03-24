import {
  EngineEventMap,
  GameEngine,
  InputBuffer,
  ServerMsg,
} from '@stacktris/shared';
import { WSClient } from '../ws/WSClient';
import { InputHandler } from './InputHandler';
import { Canvases, renderGameState } from '../render';


export const TICK_MS = 16; // ~60

export class NetworkGame {

  private gameEngine: GameEngine;

  private inputHandler: InputHandler;
  private inputBuffer: InputBuffer = [];


  // Frame timing variables
  private rafId = 0;
  private frameCount = 0;
  private lastFrameTime = 0;
  private simTime = 0;

  constructor(seed: number, private readonly ws: WSClient) {
    this.gameEngine = new GameEngine({ seed });

    this.inputHandler = new InputHandler(action => {
      this.inputBuffer.push({ action, frame: this.frameCount });
      this.gameEngine.handleInput(action);
    })

    this.ws.on('game_snapshot', (msg: ServerMsg) => {
      // this.gameEngine.setState(snapshot);
    })

    this.ws.on('game_garbage_incoming', (msg: { lines: number, triggerFrame: number }) => {
      this.gameEngine.addGarbage(msg.lines, msg.triggerFrame);
    })

    this.ws.on('gravity_update', (msg: { level: number }) => {
      this.gameEngine.setGravityLevel(msg.level);
    })

    this.gameEngine.subscribe('gameOver', () => {
      this.ws.send({ type: 'player_died' });
    });
  }

  get state() {
    return this.gameEngine.getState();
  }

  get currentFrame() {
    return this.frameCount;
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


          if (this.frameCount % 180 === 0) {
            this.ws.send({ type: 'game_action', buffer: this.inputBuffer, frame: this.frameCount });
            this.inputBuffer = [];
          }
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

  subscribe<K extends keyof EngineEventMap>(event: K, fn: (val: EngineEventMap[K]) => void): () => void {
    return this.gameEngine.subscribe(event, fn);
  }

}
