import {
  GameState, GameWithBag, createGame, applyGravity, applyInput,
  gravityTickMs, levelFromLines, InputAction,
} from '@stacktris/shared';

type SendFn = (action: InputAction) => void;

export class MultiplayerGame {
  private game: GameWithBag;
  private lastGravityMs: number = 0;

  private send: SendFn;

  constructor(_seed: number, send: SendFn) {
    this.game = createGame({ levelStrategy: levelFromLines });
    this.send = send;
  }

  get state(): GameState {
    return this.game.state;
  }

  tick(now: number): void {
    if (this.game.state.isGameOver) return;
    if (this.lastGravityMs === 0) this.lastGravityMs = now;

    const interval = gravityTickMs(this.game.state.level);
    if (now - this.lastGravityMs >= interval) {
      this.game = applyGravity(this.game, now);
      this.lastGravityMs = now;
    } else if (this.game.state.lockDelay !== null) {
      this.game = applyGravity(this.game, now);
    }
  }


  // TODO: add sequence number and buffer to inputs...
  input(action: InputAction, now: number): void {
    if (this.game.state.isGameOver) return;
    this.game = applyInput(this.game, action, now);
    this.send(action); // broadcast to server
  }


  reset(): void {
    this.game = createGame({ levelStrategy: levelFromLines });
    this.lastGravityMs = 0;
  }

}
