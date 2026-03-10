import { TetrominoType, Piece } from '../types';

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const CELL_SIZE = 28;

export const TETROMINOES: Record<TetrominoType, { shape: number[][][]; color: string }> = {
  I: {
    shape: [
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
      [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
      [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
    ],
    color: '#00f0f0',
  },
  O: {
    shape: [
      [[1,1],[1,1]],
      [[1,1],[1,1]],
      [[1,1],[1,1]],
      [[1,1],[1,1]],
    ],
    color: '#f0f000',
  },
  T: {
    shape: [
      [[0,1,0],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,1],[0,1,0]],
      [[0,1,0],[1,1,0],[0,1,0]],
    ],
    color: '#a000f0',
  },
  S: {
    shape: [
      [[0,1,1],[1,1,0],[0,0,0]],
      [[0,1,0],[0,1,1],[0,0,1]],
      [[0,0,0],[0,1,1],[1,1,0]],
      [[1,0,0],[1,1,0],[0,1,0]],
    ],
    color: '#00f000',
  },
  Z: {
    shape: [
      [[1,1,0],[0,1,1],[0,0,0]],
      [[0,0,1],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,0],[0,1,1]],
      [[0,1,0],[1,1,0],[1,0,0]],
    ],
    color: '#f00000',
  },
  J: {
    shape: [
      [[1,0,0],[1,1,1],[0,0,0]],
      [[0,1,1],[0,1,0],[0,1,0]],
      [[0,0,0],[1,1,1],[0,0,1]],
      [[0,1,0],[0,1,0],[1,1,0]],
    ],
    color: '#0000f0',
  },
  L: {
    shape: [
      [[0,0,1],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,0],[0,1,1]],
      [[0,0,0],[1,1,1],[1,0,0]],
      [[1,1,0],[0,1,0],[0,1,0]],
    ],
    color: '#f0a000',
  },
};

export const TETROMINO_TYPES: TetrominoType[] = ['I','O','T','S','Z','J','L'];

export function colorForType(type: TetrominoType): string {
  return TETROMINOES[type].color;
}

export function pieceShape(piece: Piece): number[][] {
  return TETROMINOES[piece.type].shape[piece.rotation % 4];
}

export const POINTS_PER_LINE = [0, 100, 300, 500, 800];

export const LEVEL_SPEEDS: number[] = [
  800, 720, 630, 550, 470, 380, 300, 220, 130, 100, 80,
];
