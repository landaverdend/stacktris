import {
  GameContext, createGame, applyGravity, applyInput,
  gravityTickMs, levelFromLines,
  GameSnapshot,
} from '@stacktris/shared';
import { WSClient } from '../ws/WSClient';
import { InputHandler } from './InputHandler';
import { Canvases, renderGameState } from '../render/gameState';

export class MultiplayerGame {
  private game: GameContext;
  private lastGravityMs: number = 0;

  private inputHandler: InputHandler;
  private tickCount = 0;

  private ws: WSClient;

  private rafId = 0;

  constructor(private readonly seed: number, ws: WSClient) {
    this.game = createGame({ levelStrategy: levelFromLines }, seed);

    this.ws = ws;

    this.inputHandler = new InputHandler((action) => {
      // Broadcast inputs to server
      ws.send({ type: 'game_action', action, activePiece: this.game.state.activePiece! })
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
      this.inputHandler.tick(now);
      this.tick(now);
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
    if (this.lastGravityMs === 0) this.lastGravityMs = now;

    const interval = gravityTickMs(this.game.state.level);
    if (now - this.lastGravityMs >= interval) {
      this.game = applyGravity(this.game, now);
      this.lastGravityMs = now;
      console.log(`gravity tick ${this.tickCount++}`);
    } else if (this.game.state.lockDelay !== null) {
      this.game = applyGravity(this.game, now);
      console.log(`gravity tick (lock delay) ${this.tickCount++}`);
    }
  }

  reset(): void {
    this.game = createGame({ levelStrategy: levelFromLines }, this.seed);
    this.lastGravityMs = 0;
  }


  applySnapshot(snapshot: GameSnapshot) {
    this.game.state.board = snapshot.board;
    this.game.state.activePiece = snapshot.activePiece;
    this.game.state.holdPiece = snapshot.holdPiece;
  }
}
