import { VISIBLE_ROW_START, visibleBoard } from "@stacktris/shared";
import { Canvases, GameStats } from "./SoloGameSession";
import { InputHandler } from "./InputHandler";
import { MultiplayerGame } from "./MultiplayerGame";
import { renderBoard } from "../render/board";
import { renderHold, renderQueue } from "../render/queue";

/**
 * 
 */

export class MultiplayerGameSession {

  private game: MultiplayerGame;

  private input: InputHandler;
  private onStats: (s: GameStats) => void;
  private rafId = 0;

  constructor(onStats: (s: GameStats) => void, seed: number) {

    this.onStats = onStats;
    this.game = new MultiplayerGame(seed, () => { })

    this.input = new InputHandler(action => {
      console.log('[MultiplayerGameSession] input: ', action);
      this.game.input(action, performance.now())
    })

  }

  // Pass the canvases to render game state to.
  start(canvases: Canvases) {
    this.game.reset();

    const loop = (now: number) => {
      this.input.tick(now);
      this.game.tick(now);
      this.render(canvases, now);
      this.rafId = requestAnimationFrame(loop);
    }

  }

  stop() {
    cancelAnimationFrame(this.rafId);
    this.input.detach();
  }


  private render(canvases: Canvases, now: number): void {
    const state = this.game.state;

    const boardCtx = canvases.board.getContext('2d');
    if (boardCtx) {
      const piece = state.activePiece ? {
        kind: state.activePiece.kind,
        row: state.activePiece.row - VISIBLE_ROW_START,
        col: state.activePiece.col,
        rotation: state.activePiece.rotation,
        lock_active: false,
      } : null;
      const alpha = state.lockDelay ? 0.4 + 0.6 * Math.abs(Math.sin(now * Math.PI / 180)) : 1;
      renderBoard(boardCtx, visibleBoard(state.board), piece, false, alpha);
    }

    const queueCtx = canvases.queue.getContext('2d');
    if (queueCtx) renderQueue(queueCtx, state.queue);

    const holdCtx = canvases.hold.getContext('2d');
    if (holdCtx) renderHold(holdCtx, state.holdPiece, state.holdUsed);
  }
} 