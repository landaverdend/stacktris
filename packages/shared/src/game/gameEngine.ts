import { lockPiece, spawnPiece } from "./board.js";
import { applyMovement, canMoveDown, canMoveLeft, canMoveRight, tryRotate } from "./movements.js";
import { createGameState, GameState } from "./state.js";
import { InputAction } from "./types.js";


export const LOCK_DELAY_FRAMES = 30; // 500ms at 60fps, half a second of lock delay.

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

    if (this.state.activePiece.isFloored) {
      this.handleLockDelayMode();
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
        console.log('piece is floored now')
      }
    }
  }

  handleLockDelayMode() {
    // Increment time on floor frames
    this.state.activePiece.timeOnFloor++;

    if (this.state.activePiece.timeOnFloor >= LOCK_DELAY_FRAMES) {
      // Safety: snap to floor before locking in case a rotation kick moved the piece off the ground
      while (canMoveDown(this.state.board, this.state.activePiece)) {
        console.log('moving piece down to floor')
        applyMovement(this.state.activePiece, 'move_down');
      }

      lockPiece(this.state.board, this.state.activePiece);
      this.spawnNewPiece();
    }

  }


  // Grab from the bag, spawn piece onto the board.
  spawnNewPiece() {
    const newPiece = spawnPiece(this.state.board, this.state.bag.next());
    this.state.activePiece = newPiece;
  }

  handleInput(input: InputAction) {

    if (this.state.activePiece.isFloored) {
      // Take off a reset from the total amoutn remaining.
      this.state.activePiece.totalResets++;

      console.log('total resets: ', this.state.activePiece.totalResets);
      if (this.state.activePiece.totalResets < 15) {
        this.state.activePiece.timeOnFloor = 0;
      }
    }


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