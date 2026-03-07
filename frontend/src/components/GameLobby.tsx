import React, { useState } from 'react';

interface Props {
  onCreateRoom: (betSats: number) => void;
  onJoinRoom: (roomId: string, betSats: number) => void;
  onPlaySolo: () => void;
}

export const GameLobby: React.FC<Props> = ({ onCreateRoom, onJoinRoom, onPlaySolo }) => {
  const [betSats, setBetSats] = useState(1000);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [tab, setTab] = useState<'create' | 'join' | 'solo'>('create');

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>⚡ Stacktris</h1>
      <p style={styles.subtitle}>Battle Tetris on Lightning</p>

      <div style={styles.tabs}>
        {(['create', 'join', 'solo'] as const).map(t => (
          <button
            key={t}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === 'create' ? 'Create Room' : t === 'join' ? 'Join Room' : 'Play Solo'}
          </button>
        ))}
      </div>

      <div style={styles.panel}>
        {tab === 'solo' && (
          <div style={styles.section}>
            <p style={styles.hint}>Practice mode — no Lightning required</p>
            <button style={styles.primaryBtn} onClick={onPlaySolo}>
              Start Solo Game
            </button>
          </div>
        )}

        {tab === 'create' && (
          <div style={styles.section}>
            <label style={styles.label}>Bet Amount (sats)</label>
            <input
              type="number"
              style={styles.input}
              value={betSats}
              min={1}
              onChange={e => setBetSats(Number(e.target.value))}
            />
            <button style={styles.primaryBtn} onClick={() => onCreateRoom(betSats)}>
              Create Room
            </button>
          </div>
        )}

        {tab === 'join' && (
          <div style={styles.section}>
            <label style={styles.label}>Room ID</label>
            <input
              type="text"
              style={styles.input}
              value={joinRoomId}
              placeholder="Enter room ID..."
              onChange={e => setJoinRoomId(e.target.value)}
            />
            <label style={styles.label}>Bet Amount (sats)</label>
            <input
              type="number"
              style={styles.input}
              value={betSats}
              min={1}
              onChange={e => setBetSats(Number(e.target.value))}
            />
            <button
              style={styles.primaryBtn}
              onClick={() => joinRoomId && onJoinRoom(joinRoomId, betSats)}
              disabled={!joinRoomId}
            >
              Join Room
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '1rem',
    padding: '2rem',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 'bold',
    color: '#f7931a',
    letterSpacing: '0.1em',
  },
  subtitle: {
    color: '#888',
    marginBottom: '1rem',
  },
  tabs: {
    display: 'flex',
    gap: '0.5rem',
  },
  tab: {
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#888',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    borderRadius: '4px',
    fontFamily: 'inherit',
  },
  tabActive: {
    background: '#f7931a',
    color: '#000',
    borderColor: '#f7931a',
  },
  panel: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: '8px',
    padding: '2rem',
    minWidth: '320px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  label: {
    color: '#aaa',
    fontSize: '0.85rem',
    letterSpacing: '0.05em',
  },
  input: {
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#f0f0f0',
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '1rem',
  },
  primaryBtn: {
    background: '#f7931a',
    border: 'none',
    color: '#000',
    padding: '0.75rem',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '0.5rem',
  },
  hint: {
    color: '#666',
    fontSize: '0.9rem',
    textAlign: 'center',
  },
};
