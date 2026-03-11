import { visibleBoard, VISIBLE_ROW_START } from '@stacktris/shared';
import { SoloGame } from './SoloGame';
import { InputHandler } from './InputHandler';
import { renderBoard } from '../render/board';
import { renderQueue, renderHold } from '../render/queue';

export interface GameStats {
  score: number;
  lines: number;
  level: number;
}

export interface Canvases {
  board: HTMLCanvasElement;
  queue: HTMLCanvasElement;
  hold: HTMLCanvasElement;
}

export class SoloGameSession {
  private game = new SoloGame();
  private input: InputHandler;
  private rafId = 0;

  private onStatUpdate: (stats: GameStats) => void;
  private lastStats: GameStats = { score: -1, lines: -1, level: -1 };

  constructor(onStatUpdate: (stats: GameStats) => void) {
    this.onStatUpdate = onStatUpdate;
    this.input = new InputHandler(action => this.game.input(action, performance.now()));
  }

  start(canvases: Canvases): void {
    this.game.reset();
    this.input.attach();

    const loop = (now: number) => {
      this.input.tick(now);
      this.game.tick(now);
      this.render(canvases, now);
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.input.detach();
  }

  private render(canvases: Canvases, now: number): void {
    const state = this.game.state;

    if (this.haveStatsChanged()) {
      const stats = { score: state.score, lines: state.lines, level: state.level };
      this.lastStats = stats;
      this.onStatUpdate(stats);
    }

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


  private haveStatsChanged() {
    const state = this.game.state;
    return state.score !== this.lastStats.score || state.lines !== this.lastStats.lines || state.level !== this.lastStats.level;
  }

}

