import { applyGarbageLines, clearLines, lockPiece, spawnPiece, COLS, Board, isValid, VISIBLE_ROW_START } from "./board.js";
import { applyMovement, canMoveDown, canMoveLeft, canMoveRight, sonicDrop, tryRotate } from "./movements.js";
import { createGameState, GameState, gravityForLevel, mulberry32, PendingGarbage } from "./state.js";
import { ActivePiece, InputAction, PieceKind } from "./types.js";
import { Emitter } from "./emitter.js";
import { boardCells } from "./pieces.js";
import { GameSnapshot } from "../protocol.js";


export const LOCK_DELAY_FRAMES = 30; // 500ms at 60fps, half a second of lock delay.
export const MAX_LOCK_RESETS = 25; // 15 moves until the piece locks in place.
export const FRAME_DURATION_MS = 1000 / 60; // 16.666ms

export const GARBAGE_DELAY_FRAMES = 60 * 4; // 7 seconds of delay

// Lines cleared → garbage lines sent to opponent. Singles send nothing.
export const GARBAGE_TABLE: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 4,
};

export type EngineConfig = {
  seed?: number;
  startLevel?: number;
  initialGameState?: GameState;
}

export type PieceLockedEvent = {
  board: Board;
  linesCleared: number;
};

export type EngineEventMap = {
  attack: number;
  pendingGarbage: PendingGarbage[];
  pieceLocked: PieceLockedEvent;
  gameOver: void;
};

/**
 * Wrapper for interacting with game state. Caller handles frames and whatnot
 */
export class GameEngine {

  private seed: number;
  private startLevel: number;
  private state: GameState;
  private tickCount = 0;
  private garbageRng: () => number;
  private emitter = new Emitter<EngineEventMap>();

  subscribe = this.emitter.subscribe.bind(this.emitter);

  constructor(config?: EngineConfig) {
    this.seed = config?.seed ?? Math.floor(Math.random() * 2 ** 32);
    this.startLevel = config?.startLevel ?? 0;
    this.garbageRng = mulberry32(this.seed);

    if (!config) {
      this.state = createGameState(this.seed);
    } else {
      this.state = config.initialGameState ?? createGameState(this.seed);
    }

    if (this.startLevel > 0 && !config?.initialGameState) {
      this.state.level = this.startLevel;
      this.state.gravity = gravityForLevel(this.startLevel);
    }
  }

  updateState(snapshot: GameSnapshot): void {
    this.tickCount = snapshot.frame;
    this.state.board = snapshot.board;
    this.state.activePiece = snapshot.activePiece as ActivePiece;
    this.state.holdPiece = snapshot.holdPiece;
    this.state.pendingGarbage = snapshot.pendingGarbage;
  }

  getState(): GameState {
    return this.state;
  }

  setGravityLevel(level: number): void {
    this.state.level = level;
    this.state.gravity = gravityForLevel(level);
  }

  /**
   * Tick happens on every frame. Smallest atomic unit of time / game logic.
   * @returns
   */
  tick(): void {
    if (this.state.isGameOver) return;

    this.tickCount++;

    this.handlePendingGarbage();

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


  /**
   * Check the garbage queue for any pending garbage and apply it to the board.
   */
  handlePendingGarbage() {
    const ready = this.state.pendingGarbage.filter(g => this.tickCount >= g.triggerFrame);
    if (ready.length === 0) return;
    this.setPendingGarbage(this.state.pendingGarbage.filter(g => this.tickCount < g.triggerFrame));
    for (const g of ready) {
      applyGarbageLines(this.state.board, g.lines, g.gap);
    }
  }


  // Grab from the bag, spawn piece onto the board. Optional param to override the kind of piece to spawn (used for holds)
  spawnNewPiece(kind?: PieceKind) {
    const newPiece = spawnPiece(this.state.board, kind ?? this.state.bag.next());

    // Block out: spawn position is already occupied
    if (!isValid(this.state.board, newPiece)) {
      this.state.isGameOver = true;
      this.emitter.emit('gameOver', undefined);
      return;
    }

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
      this.applyLevelProgression();

      const attack = GARBAGE_TABLE[linesCleared] ?? 0;
      const netAttack = this.clearPendingGarbage(attack);
      if (netAttack > 0) {
        this.emitter.emit('attack', netAttack);
      }
    }

    // Lock out: any part of the piece is in the invisible buffer zone
    const cells = [...boardCells(this.state.activePiece)];
    if (cells.some(([r]) => r < VISIBLE_ROW_START)) {
      this.state.isGameOver = true;
      this.emitter.emit('gameOver', undefined);
      return;
    }

    this.emitter.emit('pieceLocked', { board: this.state.board, linesCleared });

    this.spawnNewPiece();
    this.state.holdUsed = false;
  }

  handleInput(input: InputAction) {
    let moved = false;

    switch (input) {
      case 'move_left':
        if (canMoveLeft(this.state.board, this.state.activePiece)) {
          applyMovement(this.state.activePiece, 'move_left');
          moved = true;
        }
        break;

      case 'move_right':
        if (canMoveRight(this.state.board, this.state.activePiece)) {
          applyMovement(this.state.activePiece, 'move_right');
          moved = true;
        }
        break;
      // TODO: if they are already on the ground, lock the piece into place.
      case 'soft_drop':
        if (canMoveDown(this.state.board, this.state.activePiece)) {
          applyMovement(this.state.activePiece, 'move_down');
          moved = true;
        }
        break;
      case 'rotate_cw':
        moved = tryRotate(this.state.board, this.state.activePiece, true);
        break;
      case 'rotate_ccw':
        moved = tryRotate(this.state.board, this.state.activePiece, false);
        break;
      case 'hard_drop':
        sonicDrop(this.state.board, this.state.activePiece);
        this.handleLock();
        return; // no reset logic needed after a hard drop

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
        return; // no reset logic needed after a hold
    }

    if (moved && this.state.activePiece.isFloored) {
      this.state.activePiece.totalResets++;
      if (this.state.activePiece.totalResets < MAX_LOCK_RESETS) {
        this.state.activePiece.timeOnFloor = 0;
      }
    }
  }

  addGarbage(n: number, triggerFrame: number): void {
    const gap = Math.floor(this.garbageRng() * COLS);
    this.setPendingGarbage([...this.state.pendingGarbage, { lines: n, triggerFrame: triggerFrame + GARBAGE_DELAY_FRAMES, gap }]);
  }

  clearPendingGarbage(n: number): number {
    const queue = [...this.state.pendingGarbage];
    while (n > 0 && queue.length > 0) {
      const first = queue[0];
      if (first.lines <= n) {
        n -= first.lines;
        queue.shift();
      } else {
        queue[0] = { ...first, lines: first.lines - n };
        n = 0;
      }
    }
    this.setPendingGarbage(queue);
    return n; // leftover lines not cancelled = net attack
  }

  private applyLevelProgression(): void {
    if (this.state.gravityMode !== 'solo') return;

    const threshold = this.startLevel * 10 + 10;
    const newLevel = this.state.lines < threshold
      ? this.startLevel
      : this.startLevel + 1 + Math.floor((this.state.lines - threshold) / 10);

    this.state.level = newLevel;
    this.state.gravity = gravityForLevel(newLevel);
  }

  private setPendingGarbage(val: PendingGarbage[]): void {
    this.state.pendingGarbage = val;
    this.emitter.emit('pendingGarbage', val);
  }

}
