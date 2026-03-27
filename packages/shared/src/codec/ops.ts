export function bigEndianToInteger(bytes: Uint8Array): bigint {
  let result = 0n;

  for (let i = 0; i < bytes.length; i++) {
    result = (result << 8n) | BigInt(bytes[i]);
  }

  return result;
}

// 01020304 => [01, 02, 03, 04]
export function integerToBigEndian(value: number | bigint, length: number) {
  const bytes = new Uint8Array(length);

  if (typeof value === 'number') {
    value = BigInt(value);
  }

  let temp = value;
  let i = length - 1;
  while (temp > 0n && i >= 0n) {
    bytes[i] = Number(temp & 0xffn);
    temp >>= 8n;
    i--;
  }

  return bytes;
}


export function encodeVarInt(value: number | bigint) {
  value = BigInt(value);

  if (value < 0xfdn) {
    return new Uint8Array([Number(value)]);
  }
  // 2^16
  else if (value < 0x10000n) {
    return new Uint8Array([0xfd, ...integerToBigEndian(value, 2)]);
  }
  // 2^32
  else if (value < 0x100000000n) {
    return new Uint8Array([0xfe, ...integerToBigEndian(value, 4)]);
  }
  // 2^64 is max value
  else if (value < 0x10000000000000000n) {
    return new Uint8Array([0xff, ...integerToBigEndian(value, 8)]);
  } else {
    throw new Error('Value too large to encode as a varint.');
  }
}


export function readVarInt(bytes: Uint8Array) {
  const firstByte = bytes[0];

  // Oxfd means the next 2 bytes are a 16-bit integer
  if (firstByte === 0xfd) {
    return bigEndianToInteger(bytes.slice(1, 3));
  } else if (firstByte === 0xfe) {
    return bigEndianToInteger(bytes.slice(1, 5));
  } else if (firstByte === 0xff) {
    return bigEndianToInteger(bytes.slice(1, 9));
  } else {
    return firstByte;
  }
}