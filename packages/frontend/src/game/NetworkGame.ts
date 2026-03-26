import {
  EngineEventMap,
  FRAME_DURATION_MS,
  GameEngine,
  GameFrame,
  GameState,
  InputBuffer,
  ServerMsg,
} from '@stacktris/shared';
import { WSClient } from '../ws/WSClient';
import { InputHandler } from './InputHandler';
import { Canvases, renderGameState } from '../render';


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

    this.gameEngine = new GameEngine({ seed, gravityMode: 'multiplayer' });

    this.inputHandler = new InputHandler(action => {
      this.inputBuffer.push({ action, frame: this.frameCount });
      this.gameEngine.handleInput(action);
    })

    this.ws.on('game_state_update', (msg: { type: 'game_state_update'; frame: GameFrame }) => {
      this.gameEngine.updateState(msg.frame);
      this.frameCount = msg.frame.frame;
    })

    this.ws.on('game_garbage_incoming', (msg: { lines: number, triggerFrame: number }) => {
      this.gameEngine.addGarbage(msg.lines, msg.triggerFrame);
    })

    this.ws.on('gravity_update', (msg: { level: number }) => {
      this.gameEngine.setGravityLevel(msg.level);
    })

    this.gameEngine.subscribe('gameOver', () => {
      this.inputHandler.detach();
      setTimeout(() => this.ws.send({ type: 'player_died' }), 600);
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

        while (this.simTime >= FRAME_DURATION_MS) {
          this.frameCount++;

          this.inputHandler.tick(now);
          this.gameEngine.tick();

          this.simTime -= FRAME_DURATION_MS;


          if (this.frameCount % 10 === 0) {
            this.ws.send({ type: 'game_action', buffer: this.inputBuffer, frame: this.frameCount });
            this.inputBuffer = [];
          }

          // Send out a heartbeat every 5 seconds
          if (this.frameCount % 300 === 0) {
            const { board, activePiece, holdPiece, holdUsed, isGameOver, gravity, pendingGarbage, bag } = this.gameEngine.getState();
            this.ws.send({ type: 'game_state_heartbeat', state: { board, activePiece, holdPiece, holdUsed, isGameOver, gravityLevel: gravity, pendingGarbage, bagPosition: bag.position, frame: this.frameCount } });
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
    this.gameEngine = new GameEngine({});
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.inputHandler.detach();
  }

  subscribe<K extends keyof EngineEventMap>(event: K, fn: (val: EngineEventMap[K]) => void): () => void {
    return this.gameEngine.subscribe(event, fn);
  }

}
