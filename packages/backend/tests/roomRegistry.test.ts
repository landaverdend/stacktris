import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomRegistry } from '../src/roomRegistry.js';
import { SendFn } from '../src/types.js';
import { MAX_PLAYERS } from '../src/room.js';

const makeSend = (): SendFn => vi.fn();

function connect(registry: RoomRegistry, playerId: string) {
  const send = makeSend();
  registry.onConnect(playerId, send);
  return send;
}

describe('RoomRegistry', () => {
  let registry: RoomRegistry;

  beforeEach(() => {
    registry = new RoomRegistry();
  });

  describe('create_room', () => {
    it('creates a room and adds the player to it', () => {
      connect(registry, 'p1');
      registry.onMessage('p1', '', { type: 'create_room', bet_sats: 0 });
      expect(registry.roomCount).toBe(1);
    });

    it('player is placed in a room after creating one', () => {
      connect(registry, 'p1');
      registry.onMessage('p1', '', { type: 'create_room', bet_sats: 0 });
      expect(registry.roomForPlayer('p1')).toBeDefined();
    });
  });

  describe('join_room', () => {
    it('second player can join an existing room', () => {
      connect(registry, 'p1');
      connect(registry, 'p2');
      registry.onMessage('p1', '', { type: 'create_room', bet_sats: 0 });

      const roomId = registry.roomForPlayer('p1')!;
      registry.onMessage('p2', '', { type: 'join_room', room_id: roomId });

      expect(registry.roomForPlayer('p2')).toBe(roomId);
    });

    it('joining a nonexistent room is a no-op', () => {
      connect(registry, 'p1');
      expect(() =>
        registry.onMessage('p1', '', { type: 'join_room', room_id: 'does-not-exist' })
      ).not.toThrow();
    });
  });

  describe('leave_room', () => {
    it('removes the player from the room', () => {
      connect(registry, 'p1');
      registry.onMessage('p1', '', { type: 'create_room', bet_sats: 0 });
      registry.onMessage('p1', '', { type: 'leave_room', room_id: '' });
      expect(registry.roomForPlayer('p1')).toBeUndefined();
    });

    it('removes the room when the last player leaves', () => {
      connect(registry, 'p1');
      registry.onMessage('p1', '', { type: 'create_room', bet_sats: 0 });
      registry.onMessage('p1', '', { type: 'leave_room', room_id: '' });
      expect(registry.roomCount).toBe(0);
    });

    it('keeps the room alive when one of two players leaves', () => {
      connect(registry, 'p1');
      connect(registry, 'p2');
      registry.onMessage('p1', '', { type: 'create_room', bet_sats: 0 });
      const roomId = registry.roomForPlayer('p1')!;
      registry.onMessage('p2', '', { type: 'join_room', room_id: roomId });
      registry.onMessage('p1', '', { type: 'leave_room', room_id: '' });
      expect(registry.roomCount).toBe(1);
      expect(registry.roomForPlayer('p2')).toBe(roomId);
    });

    it('leaving when not in a room is a no-op', () => {
      connect(registry, 'p1');
      expect(() =>
        registry.onMessage('p1', '', { type: 'leave_room', room_id: '' })
      ).not.toThrow();
    });
  });


  describe('listRooms', () => {
    it('returns waiting rooms', () => {
      connect(registry, 'p1');
      registry.onMessage('p1', '', { type: 'create_room', bet_sats: 0 });
      expect(registry.listRooms()).toHaveLength(1);
    });

    it('does not return rooms that are in progress', () => {
      vi.useFakeTimers();
      connect(registry, 'p1');
      connect(registry, 'p2');
      registry.onMessage('p1', '', { type: 'create_room', bet_sats: 0 });
      const roomId = registry.roomForPlayer('p1')!;
      registry.onMessage('p2', '', { type: 'join_room', room_id: roomId });
      registry.onMessage('p1', '', { type: 'ready_update', ready: true });
      registry.onMessage('p2', '', { type: 'ready_update', ready: true });
      vi.advanceTimersByTime(3500);
      expect(registry.listRooms()).toHaveLength(0);
      vi.useRealTimers();
    });

    it('does not return rooms that are full', () => {
      connect(registry, 'first');
      registry.onMessage('first', '', { type: 'create_room', bet_sats: 0 });
      const roomId = registry.roomForPlayer('first')!;
      for (let i = 0; i < MAX_PLAYERS - 1; i++) {
        connect(registry, `p${i}`);
        registry.onMessage(`p${i}`, '', { type: 'join_room', room_id: roomId });
      }
      expect(registry.listRooms()).toHaveLength(0);
    })

    it('does not return a room that is mid-match', () => {
      vi.useFakeTimers();
      connect(registry, 'first');
      registry.onMessage('first', '', { type: 'create_room', bet_sats: 0 });

      const roomId = registry.roomForPlayer('first')!;
      connect(registry, 'second');

      registry.onMessage('second', '', { type: 'join_room', room_id: roomId });

      // Both players ready up
      // Game starts
      registry.onMessage('first', '', { type: 'ready_update', ready: true });
      registry.onMessage('second', '', { type: 'ready_update', ready: true });

      vi.advanceTimersByTime(5000);
      expect(registry.listRooms()).toHaveLength(0);
    })

  });

  describe('onDisconnect', () => {
    it('removes the player from the registry', () => {
      connect(registry, 'p1');
      registry.onMessage('p1', '', { type: 'create_room', bet_sats: 0 });
      registry.onDisconnect('p1');
      expect(registry.roomForPlayer('p1')).toBeUndefined();
    });

    it('disconnecting unknown player is a no-op', () => {
      expect(() => registry.onDisconnect('ghost')).not.toThrow();
    });

    it('removes the room from the registry if the last player disconnects', () => {
      connect(registry, 'p1');

      // Create a room for the player.
      registry.onMessage('p1', '', { type: 'create_room', bet_sats: 0 });

      // Disconnect the player
      registry.onDisconnect('p1')

      expect(registry.roomCount).toBe(0);
    })

  });
});
