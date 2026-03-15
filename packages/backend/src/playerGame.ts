import {
  GameEngine,
  GameSnapshot,
  InputBuffer,
} from "@stacktris/shared";


export class PlayerGame {

  private gameEngine: GameEngine;

  private frameCount = 0;

  constructor(seed: number) {
    this.gameEngine = new GameEngine({
      seed, onLinesCleared: (lines) => {
        console.log(`[PlayerGame] lines cleared ${lines}`)
      }
    })
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
      while (this.frameCount < input.frame) {
        this.gameEngine.tick();
        this.frameCount++;
      }
      this.gameEngine.handleInput(input.action);
    }

    // Tick the rest of the window so gravity and lock delay fire even with no inputs
    while (this.frameCount < upToFrame) {
      this.gameEngine.tick();
      this.frameCount++;
    }
  }
}