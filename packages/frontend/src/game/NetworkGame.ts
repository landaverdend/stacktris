import {
  GameEngine,
  GameSnapshot,
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
      console.log('NetworkGame game snapshot', msg);
    })
  }

  get state() {
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


          if (this.frameCount % 180 === 0) {
            console.log('NetworkGame flush replay buffer');
            this.ws.send({ type: 'game_action', buffer: this.inputBuffer });
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

}
