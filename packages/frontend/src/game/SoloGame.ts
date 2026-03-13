import { GameState, GameContext, createGame, applyGravity, applyInput, gravityTickMs, levelFromLines, InputAction } from '@stacktris/shared';

export class SoloGame {
  private game: GameContext;
  private lastGravityMs: number = 0;

  constructor() {
    this.game = createGame({ levelStrategy: levelFromLines });
  }

  get state(): GameState {
    return this.game.state;
  }

  reset(): void {
    this.game = createGame({ levelStrategy: levelFromLines });
    this.lastGravityMs = 0;
  }

  tick(now: number): void {
    if (this.game.state.isGameOver) return;
    if (this.lastGravityMs === 0) this.lastGravityMs = now;

    const interval = gravityTickMs(this.game.state.level);
    if (now - this.lastGravityMs >= interval) {
      this.game = applyGravity(this.game, now);
      this.lastGravityMs = now;
    } else if (this.game.state.lockDelay !== null) {
      // Keep ticking lock delay even between gravity intervals
      this.game = applyGravity(this.game, now);
    }
  }

  input(action: InputAction, now: number): void {
    if (this.game.state.isGameOver) return;
    this.game = applyInput(this.game, action, now);
  }
}
