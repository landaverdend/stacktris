import { describe, it, expect } from 'vitest';
import { encodeServerMsg, decodeMsg, MsgCode } from '../src/codec/codec.js';

describe('payout_pending encode', () => {
  it('first byte is the PAYOUT_PENDING opcode', () => {
    const buf = encodeServerMsg({ type: 'payout_pending', amountSats: 1000, lightningAddress: 'test@wallet.com' });
    expect(buf[0]).toBe(MsgCode.PAYOUT_PENDING);
  });

  it('encodes a small amount as a single varint byte', () => {
    const buf = encodeServerMsg({ type: 'payout_pending', amountSats: 100, lightningAddress: 'a@b.com' });
    // 100 < 0xfd so varint is 1 byte: [opcode, 0x64, ...invoice]
    expect(buf[1]).toBe(0x64);
  });

  it('encodes a large amount with 0xfd varint prefix', () => {
    const buf = encodeServerMsg({ type: 'payout_pending', amountSats: 1000, lightningAddress: 'a@b.com' });
    // 1000 > 252 so varint is [0xfd, 0x03, 0xe8]
    expect(buf[1]).toBe(0xfd);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0xe8);
  });

  it('encodes the lightning address as utf-8 at the end of the buffer', () => {
    const address = 'satoshi@bitcoin.org';
    const buf = encodeServerMsg({ type: 'payout_pending', amountSats: 1, lightningAddress: address });
    const invoiceBytes = buf.slice(2); // opcode (1) + varint for 1 (1)
    expect(new TextDecoder().decode(invoiceBytes)).toBe(address);
  });
});

describe('payout_pending decode', () => {
  it('decodes type correctly', () => {
    const buf = encodeServerMsg({ type: 'payout_pending', amountSats: 500, lightningAddress: 'a@b.com' });
    const msg = decodeMsg(buf);
    expect(msg.type).toBe('payout_pending');
  });

  it('decodes the amount correctly', () => {
    const buf = encodeServerMsg({ type: 'payout_pending', amountSats: 500, lightningAddress: 'a@b.com' });
    const msg = decodeMsg(buf) as { type: 'payout_pending'; amountSats: number; lightningAddress: string };
    expect(msg.amountSats).toBe(500);
  });

  it('decodes the lightning address correctly', () => {
    const buf = encodeServerMsg({ type: 'payout_pending', amountSats: 500, lightningAddress: 'satoshi@bitcoin.org' });
    const msg = decodeMsg(buf) as { type: 'payout_pending'; amountSats: number; lightningAddress: string };
    expect(msg.lightningAddress).toBe('satoshi@bitcoin.org');
  });

  it('throws on unknown opcode', () => {
    expect(() => decodeMsg(new Uint8Array([0xff]))).toThrow();
  });
});

describe('client message round-trips', () => {
  it('create_room', () => {
    const msg = { type: 'create_room' as const, buy_in: 1000 };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('create_room');
    expect(decoded.buy_in).toBe(1000);
  });

  it('create_room with zero buy_in', () => {
    const msg = { type: 'create_room' as const, buy_in: 0 };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.buy_in).toBe(0);
  });

  it('join_room', () => {
    const msg = { type: 'join_room' as const, room_id: 'room-abc' };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('join_room');
    expect(decoded.room_id).toBe('room-abc');
  });

  it('leave_room', () => {
    const msg = { type: 'leave_room' as const, room_id: 'room-abc' };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('leave_room');
    expect(decoded.room_id).toBe('room-abc');
  });

  it('ready_update true', () => {
    const msg = { type: 'ready_update' as const, ready: true };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('ready_update');
    expect(decoded.ready).toBe(true);
  });

  it('ready_update false', () => {
    const msg = { type: 'ready_update' as const, ready: false };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.ready).toBe(false);
  });

  it('player_died has no payload', () => {
    const msg = { type: 'player_died' as const };
    const buf = encodeServerMsg(msg);
    expect(buf.length).toBe(1);
    expect(buf[0]).toBe(MsgCode.PLAYER_DIED);
    expect(decodeMsg(buf)).toEqual({ type: 'player_died' });
  });

  it('first byte is always the correct opcode', () => {
    expect(encodeServerMsg({ type: 'create_room', buy_in: 0 })[0]).toBe(MsgCode.CREATE_ROOM);
    expect(encodeServerMsg({ type: 'join_room', room_id: 'x' })[0]).toBe(MsgCode.JOIN_ROOM);
    expect(encodeServerMsg({ type: 'leave_room', room_id: 'x' })[0]).toBe(MsgCode.LEAVE_ROOM);
    expect(encodeServerMsg({ type: 'ready_update', ready: true })[0]).toBe(MsgCode.READY_UPDATE);
    expect(encodeServerMsg({ type: 'player_died' })[0]).toBe(MsgCode.PLAYER_DIED);
  });
});

describe('opcode + id round-trips', () => {
  it('welcome', () => {
    const msg = { type: 'welcome' as const, player_id: 'abc-123' };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('welcome');
    expect(decoded.player_id).toBe('abc-123');
  });

  it('session_created', () => {
    const msg = { type: 'session_created' as const, room_id: 'room-xyz' };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('session_created');
    expect(decoded.room_id).toBe('room-xyz');
  });

  it('session_joined', () => {
    const msg = { type: 'session_joined' as const, room_id: 'room-xyz' };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('session_joined');
    expect(decoded.room_id).toBe('room-xyz');
  });

  it('bet_payment_confirmed', () => {
    const msg = { type: 'bet_payment_confirmed' as const, playerId: 'player-42' };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('bet_payment_confirmed');
    expect(decoded.playerId).toBe('player-42');
  });

  it('game_player_died', () => {
    const msg = { type: 'game_player_died' as const, playerId: 'player-99' };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('game_player_died');
    expect(decoded.playerId).toBe('player-99');
  });

  it('error', () => {
    const msg = { type: 'error' as const, message: 'something went wrong' };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('error');
    expect(decoded.message).toBe('something went wrong');
  });

  it('first byte is always the correct opcode', () => {
    expect(encodeServerMsg({ type: 'welcome', player_id: 'x' })[0]).toBe(MsgCode.WELCOME);
    expect(encodeServerMsg({ type: 'session_created', room_id: 'x' })[0]).toBe(MsgCode.SESSION_CREATED);
    expect(encodeServerMsg({ type: 'session_joined', room_id: 'x' })[0]).toBe(MsgCode.SESSION_JOINED);
    expect(encodeServerMsg({ type: 'bet_payment_confirmed', playerId: 'x' })[0]).toBe(MsgCode.BET_PAYMENT_CONFIRMED);
    expect(encodeServerMsg({ type: 'game_player_died', playerId: 'x' })[0]).toBe(MsgCode.GAME_PLAYER_DIED);
    expect(encodeServerMsg({ type: 'error', message: 'x' })[0]).toBe(MsgCode.ERROR);
  });
});

describe('payout_pending round-trip', () => {
  it('round-trips a small amount', () => {
    const msg = { type: 'payout_pending' as const, amountSats: 21, lightningAddress: 'user@wallet.io' };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.amountSats).toBe(msg.amountSats);
    expect(decoded.lightningAddress).toBe(msg.lightningAddress);
  });

  it('round-trips a large amount', () => {
    const msg = { type: 'payout_pending' as const, amountSats: 1_000_000, lightningAddress: 'winner@lightning.node' };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.amountSats).toBe(msg.amountSats);
    expect(decoded.lightningAddress).toBe(msg.lightningAddress);
  });

  it('round-trips a lightning address with special characters', () => {
    const msg = { type: 'payout_pending' as const, amountSats: 500, lightningAddress: 'user+test@my-node.btc.org' };
    const decoded = decodeMsg(encodeServerMsg(msg)) as typeof msg;
    expect(decoded.lightningAddress).toBe(msg.lightningAddress);
  });
});
