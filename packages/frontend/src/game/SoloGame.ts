import { GameState, GameWithBag, createGame, applyGravity, applyInput, gravityTickMs, InputAction } from '@stacktris/shared';

export class SoloGame {
  private game: GameWithBag;
  private lastGravityMs: number = 0;

  constructor() {
    this.game = createGame();
  }

  get state(): GameState {
    return this.game.state;
  }

  reset(): void {
    this.game = createGame();
    this.lastGravityMs = 0;
  }

  tick(now: number): void {
    if (this.game.state.isGameOver) return;
    if (this.lastGravityMs === 0) this.lastGravityMs = now;

    const interval = gravityTickMs(this.game.state.level);
    if (now - this.lastGravityMs >= interval) {
      this.game = applyGravity(this.game);
      this.lastGravityMs = now;
    }
  }

  input(action: InputAction): void {
    if (this.game.state.isGameOver) return;
    this.game = applyInput(this.game, action);
  }
}
