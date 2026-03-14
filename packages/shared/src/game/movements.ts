import { ActivePiece } from "./pieces.js";
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
    case 'rotate_cw':
      console.log('rotate_cw');
      break;
    case 'rotate_ccw':
      console.log('rotate_ccw');
      break;
  }
}