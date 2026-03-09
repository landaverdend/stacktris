import React from 'react';
import { Board, Piece } from '../types';
import { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE, TETROMINOES } from '../constants/tetris';
import { pieceShape, colorForType } from '../game/tetris';

interface Props {
  board: Board;
  currentPiece: Piece | null;
  ghost: Piece | null;
  dimmed?: boolean;
}

export const TetrisBoard: React.FC<Props> = ({ board, currentPiece, ghost, dimmed = false }) => {
  const width = BOARD_WIDTH * CELL_SIZE;
  const height = BOARD_HEIGHT * CELL_SIZE;

  const cells: React.ReactNode[] = [];

  for (let row = 0; row < BOARD_HEIGHT; row++) {
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const cell = board[row][col];
      cells.push(
        <rect
          key={`b-${row}-${col}`}
          x={col * CELL_SIZE + 1}
          y={row * CELL_SIZE + 1}
          width={CELL_SIZE - 2}
          height={CELL_SIZE - 2}
          fill={cell ? colorForType(cell) : '#111'}
          rx={2}
        />
      );
    }
  }

  if (ghost && currentPiece) {
    const shape = pieceShape(ghost);
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (!shape[row][col]) continue;
        const gx = ghost.position.x + col;
        const gy = ghost.position.y + row;
        if (gy < 0 || gy >= BOARD_HEIGHT) continue;
        cells.push(
          <rect
            key={`g-${row}-${col}`}
            x={gx * CELL_SIZE + 1}
            y={gy * CELL_SIZE + 1}
            width={CELL_SIZE - 2}
            height={CELL_SIZE - 2}
            fill="none"
            stroke={colorForType(currentPiece.type)}
            strokeWidth={1.5}
            opacity={0.4}
            rx={2}
          />
        );
      }
    }
  }

  if (currentPiece) {
    const shape = pieceShape(currentPiece);
    const color = colorForType(currentPiece.type);
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (!shape[row][col]) continue;
        const px = currentPiece.position.x + col;
        const py = currentPiece.position.y + row;
        if (py < 0 || py >= BOARD_HEIGHT) continue;
        cells.push(
          <rect
            key={`p-${row}-${col}`}
            x={px * CELL_SIZE + 1}
            y={py * CELL_SIZE + 1}
            width={CELL_SIZE - 2}
            height={CELL_SIZE - 2}
            fill={color}
            rx={2}
          />
        );
      }
    }
  }

  return (
    <svg
      width={width}
      height={height}
      className={`block border-2 border-border-hi bg-pit ${dimmed ? 'opacity-50' : 'opacity-100'}`}
    >
      {cells}
    </svg>
  );
};

interface NextPieceProps {
  piece: Piece | null;
}

export const NextPiece: React.FC<NextPieceProps> = ({ piece }) => {
  const size = 4 * CELL_SIZE;
  if (!piece) return <div style={{ width: size, height: size }} />;

  const shape = TETROMINOES[piece.type].shape[0];
  const color = colorForType(piece.type);

  const cells = shape.flatMap((row, ri) =>
    row.map((cell, ci) =>
      cell ? (
        <rect
          key={`n-${ri}-${ci}`}
          x={ci * CELL_SIZE + 1}
          y={ri * CELL_SIZE + 1}
          width={CELL_SIZE - 2}
          height={CELL_SIZE - 2}
          fill={color}
          rx={2}
        />
      ) : null
    )
  );

  return (
    <svg width={size} height={size} className="bg-surface border border-border-hi">
      {cells}
    </svg>
  );
};
