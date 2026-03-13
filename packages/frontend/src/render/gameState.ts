import { GameState, visibleBoard, VISIBLE_ROW_START } from '@stacktris/shared';
import { renderBoard } from './board';
import { renderQueue, renderHold } from './queue';

export interface Canvases {
  board: HTMLCanvasElement;
  queue: HTMLCanvasElement;
  hold: HTMLCanvasElement;
}

export function renderGameState(state: GameState, canvases: Canvases, now: number): void {
  const boardCtx = canvases.board.getContext('2d');
  if (boardCtx) {
    const piece = state.activePiece ? {
      kind: state.activePiece.kind,
      row: state.activePiece.row - VISIBLE_ROW_START,
      col: state.activePiece.col,
      rotation: state.activePiece.rotation,
      lock_active: false,
    } : null;
    const alpha = state.activePiece?.lockDelay ? 0.4 + 0.6 * Math.abs(Math.sin(now * Math.PI / 180)) : 1;
    renderBoard(boardCtx, visibleBoard(state.board), piece, false, alpha);
  }

  const queueCtx = canvases.queue.getContext('2d');
  if (queueCtx) renderQueue(queueCtx, state.queue);

  const holdCtx = canvases.hold.getContext('2d');
  if (holdCtx) renderHold(holdCtx, state.holdPiece, state.holdUsed);
}
