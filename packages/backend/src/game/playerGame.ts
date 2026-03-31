import {
  GameEngine,
  GameFrame,
  InputBuffer,
  mulberry32,
  COLS,
} from "@stacktris/shared";


export class PlayerGame {

  private gameEngine: GameEngine;
  private garbageRng: () => number;
  private _frameCount = 0;
  get frameCount() { return this._frameCount; }

  subscribe: GameEngine['subscribe'];

  constructor(seed: number) {
    this.gameEngine = new GameEngine({ seed, gravityMode: 'multiplayer' });
    this.garbageRng = mulberry32(seed);
    this.subscribe = this.gameEngine.subscribe.bind(this.gameEngine);
  }


  addGarbage(lines: number, sentFrame: number): number {
    const gap = Math.floor(this.garbageRng() * COLS);
    this.gameEngine.addGarbage(lines, sentFrame, gap);
    return gap;
  }

  toGameFrame(): GameFrame {
    const state = this.gameEngine.getState();
    return {
      board: state.board,
      activePiece: state.activePiece,
      gravityLevel: state.gravity,
      holdPiece: state.holdPiece,
      holdUsed: state.holdUsed,
      isGameOver: state.isGameOver,
      b2b: state.b2b,
      pendingGarbage: state.pendingGarbage,
      bagPosition: state.bag.position,
      frame: this._frameCount,
    };
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

  tickTo(frame: number) {
    while (this._frameCount < frame) {
      this.gameEngine.tick();
      this._frameCount++;
    }
  }

}
