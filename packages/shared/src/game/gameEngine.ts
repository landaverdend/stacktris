import { applyMovement, canMoveDown, canMoveLeft, canMoveRight, tryRotate } from "./movements.js";
import { createGameState, GameState } from "./state.js";
import { InputAction } from "./types.js";


/**
 * Wrapper for interacting with game state. Caller handles frames and whatnot
 */
export class GameEngine {

  private state: GameState;

  constructor() {
    this.state = createGameState();
  }


  getState(): GameState {
    return this.state;
  }

  /**
   * Tick happens on every frame. Smallest atomic unit of time / game logic.
   * @returns 
   */
  tick(): void {
    if (this.state.isGameOver) return;

    // apply gravity tick.
    if (this.state.activePiece.isFloored) {
      // TODO: handle locked piece logic.
      console.log('locked piece logic.')

    } else {
      this.fall();
    }
  }


  /**
   * Apply gravity to the active piece if possible, otherwise, mark as floored.
   */
  fall() {
    this.state.gravityAccumulator += this.state.gravity;
    // Check if the accumulator has reached 1, if so, move piece down if possible
    const aboveThreshold = Math.floor(this.state.gravityAccumulator)
    this.state.gravityAccumulator -= aboveThreshold; // Keep leftover  

    // If accumulator is above threshold, move piece down if possible, otherwise kick off the lock delay  
    if (aboveThreshold > 0) {
      if (canMoveDown(this.state.board, this.state.activePiece)) {
        applyMovement(this.state.activePiece, 'move_down')
      }
      else {
        this.state.activePiece.isFloored = true;
      }
    }
  }

  handleInput(input: InputAction) {
    console.log(`[GameEngine] handling input: ${input}`);
    switch (input) {
      case 'move_left':
        if (canMoveLeft(this.state.board, this.state.activePiece)) {
          applyMovement(this.state.activePiece, 'move_left')
        }
        break;

      case 'move_right':
        if (canMoveRight(this.state.board, this.state.activePiece)) {
          applyMovement(this.state.activePiece, 'move_right')
        }
        break;

      // TODO: if they are already on the ground, lock the piece into place.
      case 'soft_drop':
        if (canMoveDown(this.state.board, this.state.activePiece)) {
          applyMovement(this.state.activePiece, 'move_down')
        }
        break;
      case 'rotate_cw':
        tryRotate(this.state.board, this.state.activePiece, true);
        break;
      case 'rotate_ccw':
        tryRotate(this.state.board, this.state.activePiece, false);
        break;
    }
  }

}
