import { clearLines, lockPiece, spawnPiece } from "./board.js";
import { applyMovement, canMoveDown, canMoveLeft, canMoveRight, sonicDrop, tryRotate } from "./movements.js";
import { createGameState, GameState } from "./state.js";
import { InputAction, PieceKind } from "./types.js";


export const LOCK_DELAY_FRAMES = 30; // 500ms at 60fps, half a second of lock delay.
export const MAX_LOCK_RESETS = 25; // 15 moves until the piece locks in place.


export type EngineConfig = {
  seed?: number;
  initialGameState?: GameState;

  onLinesCleared?: (lines: number) => void;
}

/**
 * Wrapper for interacting with game state. Caller handles frames and whatnot
 */
export class GameEngine {

  private seed: number;
  private state: GameState;

  private onLinesCleared: ((lines: number) => void) | undefined;

  constructor(config?: EngineConfig) {
    this.seed = config?.seed ?? Math.floor(Math.random() * 2 ** 32);

    if (!config) {
      this.state = createGameState(this.seed);
      this.onLinesCleared = undefined;
    } else {
      this.state = config.initialGameState ?? createGameState(this.seed);
      this.onLinesCleared = config.onLinesCleared ?? (() => { });
    }
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

        if (this.state.activePiece.row > this.state.activePiece.highestRowIndex) {
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
        applyMovement(this.state.activePiece, 'move_down');
      }

      this.handleLock();
    }

    if (canMoveDown(this.state.board, this.state.activePiece)) {
      this.state.activePiece.isFloored = false;
    }

  }

  // Grab from the bag, spawn piece onto the board. Optional param to override the kind of piece to spawn (used for holds)
  spawnNewPiece(kind?: PieceKind) {
    const newPiece = spawnPiece(this.state.board, kind ?? this.state.bag.next());
    this.state.activePiece = newPiece;
  }


  /**
   * When a piece lock happens, there are a few things that need to happen:
   * - Piece gets locked into place on the board.
   * - Lines get cleared from the board.
   * - New piece is spawned.
   * - Hold boolean is reset.
   * @returns The number of lines cleared 
   */
  handleLock() {
    lockPiece(this.state.board, this.state.activePiece);

    // Check if any lines are full and clear them. Update score and level based on the number of lines cleared.
    const linesCleared = clearLines(this.state.board);
    if (linesCleared > 0) {
      this.state.lines += linesCleared;
      this.onLinesCleared?.(linesCleared);
    }


    this.spawnNewPiece();
    this.state.holdUsed = false;
  }

  handleInput(input: InputAction) {
    if (this.state.activePiece.isFloored) {
      // Take off a reset from the total amoutn remaining.
      this.state.activePiece.totalResets++;

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

  addGarbage(n: number) {
    // this.state.pending
  }
}