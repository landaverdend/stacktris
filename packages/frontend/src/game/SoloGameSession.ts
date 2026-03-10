import { visibleBoard, VISIBLE_ROW_START } from '@stacktris/shared';
import { SoloGame } from './SoloGame';
import { InputHandler } from './InputHandler';
import { renderBoard } from '../render/board';
import { renderQueue, renderHold } from '../render/queue';

export interface Stats {
  score: number;
  lines: number;
  level: number;
}

interface Canvases {
  board: HTMLCanvasElement;
  queue: HTMLCanvasElement;
  hold: HTMLCanvasElement;
}

export class SoloGameSession {
  private game = new SoloGame();
  private input: InputHandler;
  private rafId = 0;
  private prevLines = 0;
  private onStats: (s: Stats) => void;

  constructor(onStats: (s: Stats) => void) {
    this.onStats = onStats;
    this.input = new InputHandler(action => this.game.input(action, performance.now()));
  }

  start(canvases: Canvases): void {
    this.game.reset();
    this.prevLines = 0;
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

    if (state.lines !== this.prevLines) {
      this.prevLines = state.lines;
      this.onStats({ score: state.score, lines: state.lines, level: state.level });
    }
  }
}
