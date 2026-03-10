import { describe, it, expect, vi } from 'vitest';
import { MAX_PLAYERS, Room } from '../src/room.js';
import type { SendFn } from '../src/WSServer.js';

const makeSend = (): SendFn => vi.fn();

describe('Room', () => {
  it('adds a player', () => {
    const room = new Room('room-1');
    const send = makeSend();
    room.addPlayer('player-1', send);
    expect(room.playerCount).toBe(1);
  });

  it('removes a player', () => {
    const room = new Room('room-1');
    room.addPlayer('player-1', makeSend());
    room.removePlayer('player-1');
    expect(room.playerCount).toBe(0);
  });

  it('does not exceed MAX_PLAYERS players', () => {
    const room = new Room('room-1');

    for (let i = 0; i < MAX_PLAYERS; i++) {
      room.addPlayer(`player-${i}`, makeSend());
    }

    expect(() => room.addPlayer('player-3', makeSend())).toThrow();
  });

  it('reports isFull correctly', () => {
    const room = new Room('room-1');
    expect(room.isFull).toBe(false);
    room.addPlayer('player-1', makeSend());
    expect(room.isFull).toBe(false);
    room.addPlayer('player-2', makeSend());
    expect(room.isFull).toBe(true);
  });

  it('reports isEmpty correctly', () => {
    const room = new Room('room-1');
    expect(room.isEmpty).toBe(true);
    room.addPlayer('player-1', makeSend());
    expect(room.isEmpty).toBe(false);
  });
});
