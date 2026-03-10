import {
  GameState, GameWithBag, createGame, applyGravity, applyInput,
  gravityTickMs, levelFromLines, InputAction,
} from '@stacktris/shared';

type SendFn = (action: InputAction) => void;

export class NetworkGame {
  private game: GameWithBag;
  private lastGravityMs: number = 0;
  private send: SendFn;

  constructor(seed: number, send: SendFn) {
    this.game = createGame({ levelStrategy: levelFromLines, seed });
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

  input(action: InputAction, now: number): void {
    if (this.game.state.isGameOver) return;
    this.game = applyInput(this.game, action, now);
    this.send(action); // broadcast to server
  }

  // Server correction — snap local state to server truth.
  correct(patch: Partial<GameState>): void {
    this.game = { ...this.game, state: { ...this.game.state, ...patch } };
  }
}
