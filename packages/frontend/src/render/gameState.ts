import { GameState, visibleBoard } from '@stacktris/shared';
import { renderBoard } from './board';
import { renderQueue, renderHold } from './queue';

export interface Canvases {
  board: HTMLCanvasElement;
  queue: HTMLCanvasElement;
  hold: HTMLCanvasElement;
}

export function renderGameState(state: GameState, canvases: Canvases): void {
  const boardCtx = canvases.board.getContext('2d');
  if (boardCtx) {
    const piece = state.activePiece;
    renderBoard(boardCtx, visibleBoard(state.board), piece);
  }

  const queueCtx = canvases.queue.getContext('2d');
  if (queueCtx) renderQueue(queueCtx, state.queue);

  const holdCtx = canvases.hold.getContext('2d');
  if (holdCtx) renderHold(holdCtx, state.holdPiece, state.holdUsed);
}
