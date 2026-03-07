import { Board, Cell, Piece, TetrominoType } from '../types';
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  TETROMINOES,
  TETROMINO_TYPES,
  POINTS_PER_LINE,
} from '../constants/tetris';

export function emptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

export function randomPiece(): Piece {
  const type = TETROMINO_TYPES[Math.floor(Math.random() * TETROMINO_TYPES.length)];
  return {
    type,
    position: { x: Math.floor(BOARD_WIDTH / 2) - 2, y: 0 },
    rotation: 0,
  };
}

export function pieceShape(piece: Piece): number[][] {
  return TETROMINOES[piece.type].shape[piece.rotation];
}

export function isValidPosition(board: Board, piece: Piece, dx = 0, dy = 0, newRotation?: number): boolean {
  const rotation = newRotation !== undefined ? newRotation : piece.rotation;
  const shape = TETROMINOES[piece.type].shape[rotation];
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;
      const newX = piece.position.x + col + dx;
      const newY = piece.position.y + row + dy;
      if (newX < 0 || newX >= BOARD_WIDTH) return false;
      if (newY >= BOARD_HEIGHT) return false;
      if (newY >= 0 && board[newY][newX] !== null) return false;
    }
  }
  return true;
}

export function lockPiece(board: Board, piece: Piece): Board {
  const newBoard = board.map(row => [...row]) as Board;
  const shape = pieceShape(piece);
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;
      const y = piece.position.y + row;
      const x = piece.position.x + col;
      if (y >= 0) {
        newBoard[y][x] = piece.type as Cell;
      }
    }
  }
  return newBoard;
}

export function clearLines(board: Board): { board: Board; linesCleared: number } {
  const newBoard = board.filter(row => row.some(cell => cell === null));
  const linesCleared = BOARD_HEIGHT - newBoard.length;
  const emptyRows: Board = Array.from({ length: linesCleared }, () => Array(BOARD_WIDTH).fill(null));
  return { board: [...emptyRows, ...newBoard] as Board, linesCleared };
}

export function calcScore(linesCleared: number, level: number): number {
  return (POINTS_PER_LINE[linesCleared] ?? 0) * (level + 1);
}

export function calcLevel(totalLines: number): number {
  return Math.min(Math.floor(totalLines / 10), 10);
}

export function ghostPiece(board: Board, piece: Piece): Piece {
  let ghostY = 0;
  while (isValidPosition(board, piece, 0, ghostY + 1)) {
    ghostY++;
  }
  return { ...piece, position: { ...piece.position, y: piece.position.y + ghostY } };
}

export function colorForType(type: TetrominoType): string {
  return TETROMINOES[type].color;
}
