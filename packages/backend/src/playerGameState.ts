import {
  createGame, GameWithBag, GameState, InputAction,
  applyGravity, applyInput, gravityTickMs, levelFromLines,
  GameSnapshot,
} from "@stacktris/shared";


export class PlayerGameState {

  private game: GameWithBag;
  private lastGravityMs: number = 0;
  pendingGarbage: number = 0;
  private tickCount = 0;

  constructor(seed: number) {
    this.game = createGame({ levelStrategy: levelFromLines }, seed);
  }

  get snapshot(): GameSnapshot {
    return {
      board: this.game.state.board,
      activePiece: this.game.state.activePiece,
      holdPiece: this.game.state.holdPiece,
    }
  }

  get state(): GameState {
    return this.game.state;
  }

  get isGameOver(): boolean {
    return this.game.state.isGameOver;
  }

  tick(): void {
    if (this.game.state.isGameOver) return;

    const now = Date.now();
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

  applyInput(input: InputAction): void {
    if (this.game.state.isGameOver) return;
    this.game = applyInput(this.game, input, Date.now());
  }
}
