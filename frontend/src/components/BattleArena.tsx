import React, { useEffect, useRef } from 'react';
import { TetrisBoard, NextPiece } from './TetrisBoard';
import { useTetris } from '../hooks/useTetris';
import { PlayerState } from '../types';

interface SoloArenaProps {
  onExit: () => void;
}

export const SoloArena: React.FC<SoloArenaProps> = ({ onExit }) => {
  const { state, start, moveLeft, moveRight, moveDown, rotate, hardDrop } = useTetris();
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      start();
    }
  }, [start]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); moveLeft(); break;
        case 'ArrowRight': e.preventDefault(); moveRight(); break;
        case 'ArrowDown':  e.preventDefault(); moveDown(); break;
        case 'ArrowUp':    e.preventDefault(); rotate(); break;
        case ' ':          e.preventDefault(); hardDrop(); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [moveLeft, moveRight, moveDown, rotate, hardDrop]);

  return (
    <div style={styles.arenaWrap}>
      <div style={styles.arena}>
        <div style={styles.sidebar}>
          <button style={styles.exitBtn} onClick={onExit}>← Exit</button>
          <StatBox label="Score" value={state.score.toLocaleString()} />
          <StatBox label="Lines" value={state.lines.toString()} />
          <StatBox label="Level" value={state.level.toString()} />
        </div>

        <div>
          <TetrisBoard board={state.board} currentPiece={state.currentPiece} ghost={state.ghost} />
          {state.isGameOver && (
            <div style={styles.overlay}>
              <p style={styles.gameOverText}>GAME OVER</p>
              <p style={styles.finalScore}>{state.score.toLocaleString()} pts</p>
              <button style={styles.restartBtn} onClick={start}>Play Again</button>
            </div>
          )}
        </div>

        <div style={styles.sidebar}>
          <p style={styles.sideLabel}>NEXT</p>
          <NextPiece piece={state.nextPiece} />
          <div style={styles.controls}>
            <p style={styles.sideLabel}>Controls</p>
            <p style={styles.controlHint}>← → Move</p>
            <p style={styles.controlHint}>↑ Rotate</p>
            <p style={styles.controlHint}>↓ Soft drop</p>
            <p style={styles.controlHint}>Space Hard drop</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Opponent board display (read-only, driven by server state)
interface OpponentBoardProps {
  player: PlayerState;
  label: string;
}

export const OpponentBoard: React.FC<OpponentBoardProps> = ({ player, label }) => {
  return (
    <div style={styles.opponentWrap}>
      <p style={styles.opponentLabel}>{label}</p>
      <TetrisBoard board={player.board} currentPiece={null} ghost={null} dimmed={player.isGameOver} />
      <div style={styles.opponentStats}>
        <span>{player.score.toLocaleString()} pts</span>
        <span>Lv {player.level}</span>
      </div>
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={styles.statBox}>
    <p style={styles.statLabel}>{label}</p>
    <p style={styles.statValue}>{value}</p>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  arenaWrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '1rem',
  },
  arena: {
    display: 'flex',
    gap: '1.5rem',
    alignItems: 'flex-start',
    position: 'relative',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minWidth: '120px',
  },
  exitBtn: {
    background: 'none',
    border: '1px solid #333',
    color: '#888',
    padding: '0.4rem 0.75rem',
    cursor: 'pointer',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
  },
  statBox: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: '4px',
    padding: '0.5rem 0.75rem',
  },
  statLabel: {
    color: '#666',
    fontSize: '0.7rem',
    letterSpacing: '0.1em',
    marginBottom: '0.2rem',
  },
  statValue: {
    color: '#f0f0f0',
    fontSize: '1.1rem',
    fontWeight: 'bold',
  },
  sideLabel: {
    color: '#666',
    fontSize: '0.7rem',
    letterSpacing: '0.1em',
    margin: 0,
  },
  controls: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  controlHint: {
    color: '#555',
    fontSize: '0.7rem',
    margin: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    pointerEvents: 'all',
  },
  gameOverText: {
    color: '#f00',
    fontSize: '2rem',
    fontWeight: 'bold',
    letterSpacing: '0.2em',
  },
  finalScore: {
    color: '#f0f0f0',
    fontSize: '1.2rem',
  },
  restartBtn: {
    background: '#f7931a',
    border: 'none',
    color: '#000',
    padding: '0.75rem 2rem',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  opponentWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    alignItems: 'center',
  },
  opponentLabel: {
    color: '#888',
    fontSize: '0.85rem',
    letterSpacing: '0.05em',
    margin: 0,
  },
  opponentStats: {
    display: 'flex',
    gap: '1rem',
    color: '#666',
    fontSize: '0.8rem',
  },
};
