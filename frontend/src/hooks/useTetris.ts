import { useCallback, useEffect, useRef, useState } from 'react';
import { Board, Piece } from '../types';
import {
  emptyBoard,
  randomPiece,
  isValidPosition,
  lockPiece,
  clearLines,
  calcScore,
  calcLevel,
  ghostPiece,
} from '../game/tetris';
import { LEVEL_SPEEDS } from '../constants/tetris';

export interface TetrisState {
  board: Board;
  currentPiece: Piece | null;
  nextPiece: Piece | null;
  ghost: Piece | null;
  score: number;
  lines: number;
  level: number;
  isGameOver: boolean;
  isRunning: boolean;
}

export function useTetris(onGameOver?: (score: number) => void) {
  const [state, setState] = useState<TetrisState>({
    board: emptyBoard(),
    currentPiece: null,
    nextPiece: null,
    ghost: null,
    score: 0,
    lines: 0,
    level: 0,
    isGameOver: false,
    isRunning: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const dropTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const spawnPiece = useCallback((board: Board, next: Piece | null) => {
    const piece = next ?? randomPiece();
    const nextNext = randomPiece();
    if (!isValidPosition(board, piece)) {
      return null; // game over
    }
    return { piece, nextNext };
  }, []);

  const tick = useCallback(() => {
    setState(prev => {
      if (!prev.isRunning || !prev.currentPiece) return prev;
      if (isValidPosition(prev.board, prev.currentPiece, 0, 1)) {
        const moved = { ...prev.currentPiece, position: { ...prev.currentPiece.position, y: prev.currentPiece.position.y + 1 } };
        return { ...prev, currentPiece: moved, ghost: ghostPiece(prev.board, moved) };
      }
      // Lock piece
      const locked = lockPiece(prev.board, prev.currentPiece);
      const { board: cleared, linesCleared } = clearLines(locked);
      const newLines = prev.lines + linesCleared;
      const newLevel = calcLevel(newLines);
      const newScore = prev.score + calcScore(linesCleared, newLevel);
      const spawn = spawnPiece(cleared, prev.nextPiece);
      if (!spawn) {
        onGameOver?.(newScore);
        return { ...prev, board: cleared, currentPiece: null, isGameOver: true, isRunning: false, score: newScore, lines: newLines, level: newLevel };
      }
      return {
        ...prev,
        board: cleared,
        currentPiece: spawn.piece,
        nextPiece: spawn.nextNext,
        ghost: ghostPiece(cleared, spawn.piece),
        score: newScore,
        lines: newLines,
        level: newLevel,
      };
    });
  }, [spawnPiece, onGameOver]);

  const resetDropTimer = useCallback((level: number) => {
    if (dropTimer.current) clearInterval(dropTimer.current);
    dropTimer.current = setInterval(tick, LEVEL_SPEEDS[level] ?? 100);
  }, [tick]);

  useEffect(() => {
    if (state.isRunning) {
      resetDropTimer(state.level);
    } else {
      if (dropTimer.current) clearInterval(dropTimer.current);
    }
    return () => { if (dropTimer.current) clearInterval(dropTimer.current); };
  }, [state.isRunning, state.level, resetDropTimer]);

  const start = useCallback(() => {
    const board = emptyBoard();
    const piece = randomPiece();
    const next = randomPiece();
    setState({
      board,
      currentPiece: piece,
      nextPiece: next,
      ghost: ghostPiece(board, piece),
      score: 0,
      lines: 0,
      level: 0,
      isGameOver: false,
      isRunning: true,
    });
  }, []);

  const moveLeft = useCallback(() => {
    setState(prev => {
      if (!prev.currentPiece || !prev.isRunning) return prev;
      if (!isValidPosition(prev.board, prev.currentPiece, -1, 0)) return prev;
      const moved = { ...prev.currentPiece, position: { ...prev.currentPiece.position, x: prev.currentPiece.position.x - 1 } };
      return { ...prev, currentPiece: moved, ghost: ghostPiece(prev.board, moved) };
    });
  }, []);

  const moveRight = useCallback(() => {
    setState(prev => {
      if (!prev.currentPiece || !prev.isRunning) return prev;
      if (!isValidPosition(prev.board, prev.currentPiece, 1, 0)) return prev;
      const moved = { ...prev.currentPiece, position: { ...prev.currentPiece.position, x: prev.currentPiece.position.x + 1 } };
      return { ...prev, currentPiece: moved, ghost: ghostPiece(prev.board, moved) };
    });
  }, []);

  const moveDown = useCallback(() => {
    setState(prev => {
      if (!prev.currentPiece || !prev.isRunning) return prev;
      if (!isValidPosition(prev.board, prev.currentPiece, 0, 1)) return prev;
      const moved = { ...prev.currentPiece, position: { ...prev.currentPiece.position, y: prev.currentPiece.position.y + 1 } };
      return { ...prev, currentPiece: moved, ghost: ghostPiece(prev.board, moved) };
    });
  }, []);

  const rotate = useCallback(() => {
    setState(prev => {
      if (!prev.currentPiece || !prev.isRunning) return prev;
      const newRotation = (prev.currentPiece.rotation + 1) % 4;
      // Wall kick attempts
      for (const [dx, dy] of [[0,0],[1,0],[-1,0],[2,0],[-2,0]]) {
        if (isValidPosition(prev.board, prev.currentPiece, dx, dy, newRotation)) {
          const moved = {
            ...prev.currentPiece,
            rotation: newRotation,
            position: { x: prev.currentPiece.position.x + dx, y: prev.currentPiece.position.y + dy },
          };
          return { ...prev, currentPiece: moved, ghost: ghostPiece(prev.board, moved) };
        }
      }
      return prev;
    });
  }, []);

  const hardDrop = useCallback(() => {
    setState(prev => {
      if (!prev.currentPiece || !prev.isRunning) return prev;
      let dy = 0;
      while (isValidPosition(prev.board, prev.currentPiece, 0, dy + 1)) dy++;
      const dropped = { ...prev.currentPiece, position: { ...prev.currentPiece.position, y: prev.currentPiece.position.y + dy } };
      const locked = lockPiece(prev.board, dropped);
      const { board: cleared, linesCleared } = clearLines(locked);
      const newLines = prev.lines + linesCleared;
      const newLevel = calcLevel(newLines);
      const newScore = prev.score + calcScore(linesCleared, newLevel) + dy * 2;
      const spawn = spawnPiece(cleared, prev.nextPiece);
      if (!spawn) {
        onGameOver?.(newScore);
        return { ...prev, board: cleared, currentPiece: null, isGameOver: true, isRunning: false, score: newScore, lines: newLines, level: newLevel };
      }
      return {
        ...prev,
        board: cleared,
        currentPiece: spawn.piece,
        nextPiece: spawn.nextNext,
        ghost: ghostPiece(cleared, spawn.piece),
        score: newScore,
        lines: newLines,
        level: newLevel,
      };
    });
  }, [spawnPiece, onGameOver]);

  return { state, start, moveLeft, moveRight, moveDown, rotate, hardDrop };
}
