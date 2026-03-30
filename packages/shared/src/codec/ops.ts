import { ActivePiece, InputAction, PieceKind } from '../game/types.js';
import { Board } from '../game/board.js';

// Input action index table — order must stay stable
const INPUT_ACTIONS: InputAction[] = ['move_left', 'move_right', 'rotate_cw', 'rotate_ccw', 'move_down', 'soft_drop', 'hard_drop', 'hold'];
const INPUT_ACTION_INDEX: Record<InputAction, number> = Object.fromEntries(INPUT_ACTIONS.map((a, i) => [a, i])) as Record<InputAction, number>;

/** Pack a PieceKind (or null) to a single byte. null → 7 (same sentinel as packActivePiece). */
export function packPieceKind(kind: PieceKind | null): number {
  return kind === null ? 7 : PIECE_KIND_INDEX[kind];
}

export function unpackPieceKind(byte: number): PieceKind | null {
  return byte === 7 ? null : PIECE_KINDS[byte];
}

export function encodeInputAction(action: InputAction): number {
  return INPUT_ACTION_INDEX[action];
}

export function decodeInputAction(index: number): InputAction {
  const action = INPUT_ACTIONS[index];
  if (action === undefined) throw new Error(`Unknown input action index: ${index}`);
  return action;
}

// kind order: index 0-6; index 7 is the null sentinel
const PIECE_KINDS: PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const PIECE_KIND_INDEX: Record<PieceKind, number> = { I: 0, O: 1, T: 2, S: 3, Z: 4, J: 5, L: 6 };

const NULL_PACKED = 0xFFFF; // kind=7 → null sentinel

/**
 * Pack an ActivePiece (or null) into 2 bytes.
 *
 * Bit layout (big-endian, 16 bits):
 *   bits 15-13  kind     (3 bits, 0-6; 7 = null)
 *   bits 12-11  rotation (2 bits, 0-3)
 *   bits 10-7   col      (4 bits, 0-9)
 *   bits  6-2   row      (5 bits, 0-21)
 *   bits  1-0   padding
 */
export function packActivePiece(piece: ActivePiece | null): [number, number] {
  if (piece === null) {
    return [(NULL_PACKED >> 8) & 0xFF, NULL_PACKED & 0xFF];
  }
  const kindIdx = PIECE_KIND_INDEX[piece.kind];
  // Mask col and row to their bit widths to prevent negative values from
  // corrupting the kind bits in the packed representation.
  const packed = (kindIdx << 13) | (piece.rotation << 11) | ((piece.col & 0xF) << 7) | ((piece.row & 0x1F) << 2);
  return [(packed >> 8) & 0xFF, packed & 0xFF];
}

export function unpackActivePiece(b0: number, b1: number): ActivePiece | null {
  const packed = (b0 << 8) | b1;
  const kindIdx = (packed >> 13) & 0x7;
  if (kindIdx === 7) return null;
  return {
    kind: PIECE_KINDS[kindIdx],
    rotation: (packed >> 11) & 0x3,
    col: (packed >> 7) & 0xF,
    row: (packed >> 2) & 0x1F,
    isFloored: false,
    timeOnFloor: 0,
    highestRowIndex: 0,
    totalResets: 0,
    lastActionWasRotation: false,
  };
}

const BOARD_ROWS = 22;
const VISIBLE_ROWS = 20; // strips 2-row buffer at top
const COLS = 10;
const PACKED_BOARD_BYTES = (VISIBLE_ROWS * COLS) / 2; // 100

/**
 * Pack a 22×10 Board into 100 bytes.
 * Strips the 2 invisible buffer rows, then packs two 4-bit cell values per byte.
 * Cell values 0–8 fit in 4 bits; high nibble = left cell, low nibble = right cell.
 */
export function packBoard(board: Board): Uint8Array {
  const out = new Uint8Array(PACKED_BOARD_BYTES);
  let byteIdx = 0;
  for (let r = BOARD_ROWS - VISIBLE_ROWS; r < BOARD_ROWS; r++) {
    for (let c = 0; c < COLS; c += 2) {
      out[byteIdx++] = ((board[r][c] & 0xf) << 4) | (board[r][c + 1] & 0xf);
    }
  }
  return out;
}

/**
 * Unpack 100 bytes back into a full 22×10 Board.
 * Restores the 2 invisible buffer rows as empty rows at the top.
 */
export function unpackBoard(data: Uint8Array): Board {
  const board: Board = Array.from({ length: BOARD_ROWS }, () => new Array(COLS).fill(0));
  let byteIdx = 0;
  for (let r = BOARD_ROWS - VISIBLE_ROWS; r < BOARD_ROWS; r++) {
    for (let c = 0; c < COLS; c += 2) {
      const byte = data[byteIdx++];
      board[r][c]     = (byte >> 4) & 0xf;
      board[r][c + 1] = byte & 0xf;
    }
  }
  return board;
}

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