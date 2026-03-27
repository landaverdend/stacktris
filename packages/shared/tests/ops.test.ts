import { describe, it, expect } from 'vitest';
import { bigEndianToInteger, integerToBigEndian, encodeVarInt, readVarInt } from '../src/codec/ops.js';

describe('integerToBigEndian', () => {
  it('encodes a single byte', () => {
    expect(integerToBigEndian(0x42, 1)).toEqual(new Uint8Array([0x42]));
  });

  it('encodes a u16 most-significant byte first', () => {
    expect(integerToBigEndian(0x0102, 2)).toEqual(new Uint8Array([0x01, 0x02]));
  });

  it('encodes a u32 most-significant byte first', () => {
    expect(integerToBigEndian(0x01020304, 4)).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
  });

  it('zero-pads when length is larger than needed', () => {
    expect(integerToBigEndian(0x01, 4)).toEqual(new Uint8Array([0x00, 0x00, 0x00, 0x01]));
  });

  it('encodes zero as all zero bytes', () => {
    expect(integerToBigEndian(0, 4)).toEqual(new Uint8Array([0x00, 0x00, 0x00, 0x00]));
  });

  it('accepts bigint input', () => {
    expect(integerToBigEndian(0x01020304n, 4)).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
  });

  it('encodes max u32', () => {
    expect(integerToBigEndian(0xFFFFFFFF, 4)).toEqual(new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]));
  });
});

describe('bigEndianToInteger', () => {
  it('decodes a single byte', () => {
    expect(bigEndianToInteger(new Uint8Array([0x42]))).toBe(0x42n);
  });

  it('decodes a u16 most-significant byte first', () => {
    expect(bigEndianToInteger(new Uint8Array([0x01, 0x02]))).toBe(0x0102n);
  });

  it('decodes a u32 most-significant byte first', () => {
    expect(bigEndianToInteger(new Uint8Array([0x01, 0x02, 0x03, 0x04]))).toBe(0x01020304n);
  });

  it('decodes all zeros as zero', () => {
    expect(bigEndianToInteger(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toBe(0n);
  });

  it('decodes max u32', () => {
    expect(bigEndianToInteger(new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]))).toBe(0xFFFFFFFFn);
  });
});

describe('encodeVarInt', () => {
  it('encodes 0 as a single byte', () => {
    expect(encodeVarInt(0)).toEqual(new Uint8Array([0x00]));
  });

  it('encodes values 0–252 as a single byte', () => {
    expect(encodeVarInt(1)).toEqual(new Uint8Array([0x01]));
    expect(encodeVarInt(252)).toEqual(new Uint8Array([0xfc]));
  });

  it('encodes 253 with 0xfd prefix and 2 bytes', () => {
    expect(encodeVarInt(253)).toEqual(new Uint8Array([0xfd, 0x00, 0xfd]));
  });

  it('encodes max u16 with 0xfd prefix', () => {
    expect(encodeVarInt(0xffff)).toEqual(new Uint8Array([0xfd, 0xff, 0xff]));
  });

  it('encodes u32 values with 0xfe prefix and 4 bytes', () => {
    expect(encodeVarInt(0x10000)).toEqual(new Uint8Array([0xfe, 0x00, 0x01, 0x00, 0x00]));
    expect(encodeVarInt(0xffffffff)).toEqual(new Uint8Array([0xfe, 0xff, 0xff, 0xff, 0xff]));
  });

  it('encodes u64 values with 0xff prefix and 8 bytes', () => {
    expect(encodeVarInt(0x100000000n)).toEqual(
      new Uint8Array([0xff, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00])
    );
  });

  it('throws for values >= 2^64', () => {
    expect(() => encodeVarInt(0x10000000000000000n)).toThrow();
  });

  it('accepts bigint input', () => {
    expect(encodeVarInt(252n)).toEqual(new Uint8Array([0xfc]));
    expect(encodeVarInt(0xffffn)).toEqual(new Uint8Array([0xfd, 0xff, 0xff]));
  });
});

describe('readVarInt', () => {
  it('reads a single-byte value', () => {
    expect(readVarInt(new Uint8Array([0x00]))).toBe(0);
    expect(readVarInt(new Uint8Array([0xfc]))).toBe(252);
  });

  it('reads a 2-byte value after 0xfd prefix', () => {
    expect(readVarInt(new Uint8Array([0xfd, 0x00, 0xfd]))).toBe(253n);
    expect(readVarInt(new Uint8Array([0xfd, 0xff, 0xff]))).toBe(0xffffn);
  });

  it('reads a 4-byte value after 0xfe prefix', () => {
    expect(readVarInt(new Uint8Array([0xfe, 0x00, 0x01, 0x00, 0x00]))).toBe(0x10000n);
    expect(readVarInt(new Uint8Array([0xfe, 0xff, 0xff, 0xff, 0xff]))).toBe(0xffffffffn);
  });

  it('reads an 8-byte value after 0xff prefix', () => {
    expect(readVarInt(new Uint8Array([0xff, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]))).toBe(0x100000000n);
  });

  it('ignores trailing bytes', () => {
    expect(readVarInt(new Uint8Array([0x01, 0xff, 0xff]))).toBe(1);
  });
});

describe('varint round-trip', () => {
  it('round-trips values across all tiers', () => {
    const values = [0, 1, 252, 253, 0xffff, 0x10000, 0xffffffff, 0x100000000n];
    for (const v of values) {
      const encoded = encodeVarInt(v);
      const decoded = readVarInt(encoded);
      expect(BigInt(decoded)).toBe(BigInt(v));
    }
  });
});

describe('round-trip', () => {
  it('encodes then decodes back to the original value', () => {
    const values = [0, 1, 255, 256, 0xDEAD, 0x01020304, 0xFFFFFFFF];
    for (const v of values) {
      expect(bigEndianToInteger(integerToBigEndian(v, 4))).toBe(BigInt(v));
    }
  });
});
