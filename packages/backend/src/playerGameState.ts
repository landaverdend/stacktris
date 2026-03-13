import {
  createGame, GameContext, GameState, InputAction,
  applyGravity, applyInput, gravityTickMs, levelFromLines,
  GameSnapshot,
  ActivePiece,
} from "@stacktris/shared";


export class PlayerGameState {

  private game: GameContext;
  private lastGravityMs: number = 0;
  pendingGarbage: number = 0;

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
    } else if (this.game.state.activePiece?.lockDelay !== null) {
      this.game = applyGravity(this.game, now);
    }
  }

  /**
   * Applies an input action to the game state. If it  
   * @param input 
   * @returns 
   */
  applyInput(input: InputAction, activePiece: ActivePiece): boolean {
    if (this.game.state.isGameOver) return false;
    console.log(`active piece from the client: ${JSON.stringify(activePiece)}`);
    console.log(`active piece from the game state: ${JSON.stringify(this.game.state.activePiece)}`);

    // TODO: given the active piece from the client- can we determine that it was possible to get to that position from the shadow state?


    this.game = applyInput(this.game, input, Date.now());
    return true;
  }
}
