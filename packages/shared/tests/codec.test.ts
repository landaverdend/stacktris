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
