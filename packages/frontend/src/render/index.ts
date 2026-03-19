import { GameState, LOCK_DELAY_FRAMES, visibleBoard } from '@stacktris/shared';
import { renderBoard } from './board';
import { renderHold, renderQueue } from './queue';

export interface Canvases {
  board: HTMLCanvasElement;
  queue: HTMLCanvasElement;
  hold: HTMLCanvasElement;
}

export function renderGameState(state: GameState, canvases: Canvases): void {
  const boardCtx = canvases.board.getContext('2d');
  if (boardCtx) {
    const piece = state.activePiece;
    const lockProgress = piece.isFloored ? piece.timeOnFloor / LOCK_DELAY_FRAMES : 0;
    renderBoard(boardCtx, visibleBoard(state.board), piece, false, 1 - lockProgress * 0.6);
  }

  const queueCtx = canvases.queue.getContext('2d');
  if (queueCtx) renderQueue(queueCtx, state.bag.peek());

  const holdCtx = canvases.hold.getContext('2d');
  if (holdCtx) renderHold(holdCtx, state.holdPiece, state.holdUsed);
}
