import {
  GameEngine,
  GameSnapshot,
  InputBuffer,
} from "@stacktris/shared";


export class PlayerGame {

  private gameEngine: GameEngine;
  private _frameCount = 0;
  get frameCount() { return this._frameCount; }

  subscribe: GameEngine['subscribe'];

  constructor(seed: number) {
    this.gameEngine = new GameEngine({ seed });
    this.subscribe = this.gameEngine.subscribe.bind(this.gameEngine);
  }

  addGarbage(lines: number, sentFrame: number): void {
    this.gameEngine.addGarbage(lines, sentFrame);
  }

  get snapshot(): GameSnapshot {
    return {
      board: this.gameEngine.getState().board,
      activePiece: this.gameEngine.getState().activePiece,
      holdPiece: this.gameEngine.getState().holdPiece,
    }
  }

  /**
   * When we receive a batch of inputs, we need to run them against the game engine to determine if the state is valid.
   * @param input
   */
  handleInput(batch: InputBuffer, upToFrame: number) {
    const sorted = [...batch].sort((a, b) => a.frame - b.frame);

    for (const input of sorted) {
      while (this._frameCount < input.frame) {
        this.gameEngine.tick();
        this._frameCount++;
      }
      this.gameEngine.handleInput(input.action);
    }

    // Tick the rest of the window so gravity and lock delay fire even with no inputs
    while (this._frameCount < upToFrame) {
      this.gameEngine.tick();
      this._frameCount++;
    }
  }
}
