

export type MovementAction = 'move_left' | 'move_right' | 'rotate_cw' | 'rotate_ccw' | 'move_down'

export type InputAction = MovementAction | 'soft_drop' | 'hard_drop' | 'hold';

export type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface ActivePiece {
  kind: PieceKind;
  row: number;
  col: number;
  rotation: number; // 0-3

  // How many frames the piece has been on the floor.  
  isFloored: boolean;
  timeOnFloor: number;

  highestRowIndex: number; // the lowest row the piece has touched
  // The amount of times the lock delay has been reset
  totalResets: number;
}