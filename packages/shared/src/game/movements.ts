import { Board, isValid } from "./board.js";
import { ActivePiece, kickOffsets } from "./pieces.js";
import { MovementAction } from "./types.js";


export function applyMovement(piece: ActivePiece, action: MovementAction) {

  switch (action) {
    case 'move_down':
      piece.row += 1;
      break;
    case 'move_left':
      piece.col -= 1;
      break;
    case 'move_right':
      piece.col += 1;
      break;
  }
}


export function canMoveDown(board: Board, piece: ActivePiece): boolean {
  return isValid(board, { ...piece, row: piece.row + 1 });
}

export function canMoveLeft(board: Board, piece: ActivePiece): boolean {
  return isValid(board, { ...piece, col: piece.col - 1 });
}

export function canMoveRight(board: Board, piece: ActivePiece): boolean {
  return isValid(board, { ...piece, col: piece.col + 1 });
}

// Checks if we can rotate, and if so, rotates the piece to the first available candidate
export function tryRotate(board: Board, piece: ActivePiece, cw: boolean): boolean {
  const nextRot = ((piece.rotation + (cw ? 1 : 3)) % 4) as number;
  const kicks = kickOffsets(piece.kind, piece.rotation, cw);
  for (const [dc, dr] of kicks) {
    const candidate = { ...piece, rotation: nextRot, row: piece.row + dr, col: piece.col + dc };
    // If we can rotate- go to the first available candidate
    if (isValid(board, candidate)) {
      piece.rotation = nextRot;
      piece.row = candidate.row;
      piece.col = candidate.col;
      return true;
    }
  }
  return false;
}

export function sonicDrop(board: Board, piece: ActivePiece): ActivePiece {
  let p = piece;
  while (canMoveDown(board, p)) applyMovement(p, 'move_down');
  return p;
}


