import { lockPiece, spawnPiece } from "./board.js";
import { applyMovement, canMoveDown, canMoveLeft, canMoveRight, sonicDrop, tryRotate } from "./movements.js";
import { createGameState, GameState } from "./state.js";
import { InputAction, PieceKind } from "./types.js";


export const LOCK_DELAY_FRAMES = 30; // 500ms at 60fps, half a second of lock delay.
export const MAX_LOCK_RESETS = 25; // 15 moves until the piece locks in place.

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

    if (aboveThreshold > 0) {
      if (canMoveDown(this.state.board, this.state.activePiece)) {
        applyMovement(this.state.activePiece, 'move_down')

        console.log('piece row: ', this.state.activePiece.row, 'highest row: ', this.state.activePiece.highestRowIndex);

        if (this.state.activePiece.row > this.state.activePiece.highestRowIndex) {
          console.log('piece has moved down to a new lowest row, resetting total resets')
          this.state.activePiece.highestRowIndex = this.state.activePiece.row;
          this.state.activePiece.totalResets = 0; // reset the total amount of resets used
        }


      }
    }

    // If we can't continue moving down, the piece is now floored.
    if (!canMoveDown(this.state.board, this.state.activePiece)) {
      this.state.activePiece.isFloored = true;
    }

  }

  handleLockDelayMode() {
    // Increment time on floor frames
    this.state.activePiece.timeOnFloor++;

    // We've run out of time on the floor, lock the piece in place.
    if (this.state.activePiece.timeOnFloor >= LOCK_DELAY_FRAMES) {
      // Safety: snap to floor before locking in case a rotation kick moved the piece off the ground
      while (canMoveDown(this.state.board, this.state.activePiece)) {
        console.log('moving piece down to floor')
        applyMovement(this.state.activePiece, 'move_down');
      }

      this.handleLock();
    }

    if (canMoveDown(this.state.board, this.state.activePiece)) {
      console.log('piece can move down, resetting to not floored')
      this.state.activePiece.isFloored = false;
    }

  }

  // Grab from the bag, spawn piece onto the board. Optional param to override the kind of piece to spawn (used for holds)
  spawnNewPiece(kind?: PieceKind) {
    const newPiece = spawnPiece(this.state.board, kind ?? this.state.bag.next());
    this.state.activePiece = newPiece;
  }

  handleLock() {
    lockPiece(this.state.board, this.state.activePiece);
    this.spawnNewPiece();
    this.state.holdUsed = false;
  }

  handleInput(input: InputAction) {
    if (this.state.activePiece.isFloored) {
      // Take off a reset from the total amoutn remaining.
      this.state.activePiece.totalResets++;

      console.log('total resets: ', this.state.activePiece.totalResets);
      if (this.state.activePiece.totalResets < MAX_LOCK_RESETS) {
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
      case 'hard_drop':
        sonicDrop(this.state.board, this.state.activePiece);
        this.handleLock();
        break;

      // Hold the current piece and spawn a new one
      case 'hold':
        if (this.state.holdUsed) return;

        // If first time holding, add to hold and then spawn a new piece.
        if (this.state.holdPiece === null) {
          this.state.holdPiece = this.state.activePiece.kind;
          this.spawnNewPiece();
        } else {
          const temp = this.state.holdPiece;
          this.state.holdPiece = this.state.activePiece.kind;
          this.spawnNewPiece(temp);
        }
        this.state.holdUsed = true;
        break;
    }

  }
}