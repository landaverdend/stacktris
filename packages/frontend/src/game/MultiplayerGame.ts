import {
  GameContext, createGame, applyInput,
  levelFromLines,
  GameSnapshot,
} from '@stacktris/shared';
import { WSClient } from '../ws/WSClient';
import { InputHandler } from './InputHandler';
import { Canvases, renderGameState } from '../render/gameState';
import { ReplayBuffer } from './ReplayBuffer';


export const TICK_MS = 16; // ~60

export class MultiplayerGame {
  private game: GameContext;
  isSynced = true;

  private inputHandler: InputHandler;
  private replayBuffer: ReplayBuffer;

  private frameCount = 0;
  private lastFrameTime = 0;
  private simTime = 0;


  private rafId = 0;

  constructor(private readonly seed: number, private ws: WSClient) {
    this.game = createGame({ levelStrategy: levelFromLines }, seed);


    this.replayBuffer = new ReplayBuffer(ws);
    this.inputHandler = new InputHandler((action) => {
      // Broadcast inputs to server
      this.replayBuffer.add({ action, frame: this.frameCount });
      if (this.game.state.isGameOver) return;
      this.game = applyInput(this.game, action, performance.now());
    });

    this.ws.on('game_snapshot', (msg) => {
      this.applySnapshot(msg.snapshot);
    });
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
          this.tick(now);
          this.simTime -= TICK_MS;

          // Flush the replay input buffer every 10 frames.
          if (this.frameCount % 10 === 0) {
            this.replayBuffer.flush();
          }
        }
      }

      this.lastFrameTime = now;
      renderGameState(this.game.state, canvases, now);
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.inputHandler.detach();
  }



  tick(now: number): void {
    if (this.game.state.isGameOver) return;

  }

  reset(): void {
    this.game = createGame({ levelStrategy: levelFromLines }, this.seed);
  }


  applySnapshot(snapshot: GameSnapshot) {
    this.game.state.board = snapshot.board;
    this.game.state.activePiece = snapshot.activePiece;
    this.game.state.holdPiece = snapshot.holdPiece;
  }
}
