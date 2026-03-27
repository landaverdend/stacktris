// ── Opcodes ───────────────────────────────────────────────────────────────────
// Client → Server: 0x00–0x08
// Server → Client: 0x10–0x1E

// GENERAL STRUCTURE: [opcode: 1 byte][payload: variable length per message]

import { ServerMsg } from "../protocol.js";
import { ByteStream } from "./byteStream.js";
import { encodeVarInt } from "./ops.js";

export const MsgCode = {
  // Client → Server
  CREATE_ROOM: 0x00,
  JOIN_ROOM: 0x01,
  LEAVE_ROOM: 0x02,
  READY_UPDATE: 0x03,
  SET_PLAYER_NAME: 0x04,
  PIECE_LOCKED: 0x05,
  GAME_ACTION: 0x06,
  GAME_STATE_HEARTBEAT: 0x07,
  PLAYER_DIED: 0x08,

  // Server → Client
  WELCOME: 0x10,
  SESSION_CREATED: 0x11,
  SESSION_JOINED: 0x12,
  SESSION_STATE_UPDATE: 0x13,
  BET_INVOICE_ISSUED: 0x14,
  BET_PAYMENT_CONFIRMED: 0x15,
  GAME_START: 0x16,
  GAME_STATE_UPDATE: 0x17,
  GAME_GARBAGE_INCOMING: 0x18,
  OPPONENT_BOARD_UPDATE: 0x19,
  GAME_PLAYER_DIED: 0x1A,
  OPPONENT_PIECE_UPDATE: 0x1B,
  GRAVITY_UPDATE: 0x1C,
  ERROR: 0x1D,
  PAYOUT_PENDING: 0x1E,
} as const;

export type MsgCode = typeof MsgCode[keyof typeof MsgCode];

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

// payout_pending format: [opcode: 1 byte][amount: varint][invoice: utf8, rest of buffer]
export function encodeServerMsg(msg: ServerMsg): Uint8Array {

  switch (msg.type) {
    case 'payout_pending':
      return encodePayoutPending(msg);
  }


  throw new Error(`Unknown msg: ${msg.type}`);
}

export function decodeMsg(data: Uint8Array) {
  const stream = new ByteStream(data);
  const opcode = Number(stream.read(1)[0]);

  switch (opcode) {
    case MsgCode.PAYOUT_PENDING:
      return decodePayoutPending(stream);
  }

  throw new Error(`Unknown opcode: ${opcode}`);
}


// payout_pending format: [opcode: 1 byte][amount: varint][invoice: utf8, rest of buffer]
function encodePayoutPending(msg: { type: 'payout_pending'; amountSats: number; lightningAddress: string }): Uint8Array {
  const stream = new ByteStream();

  stream.writeInt(MsgCode.PAYOUT_PENDING, 1);
  stream.write(encodeVarInt(msg.amountSats));
  stream.write(UTF8_ENCODER.encode(msg.lightningAddress));

  return stream.toBytes();
}

function decodePayoutPending(stream: ByteStream): ServerMsg {
  const amountSats = stream.readVarInt();
  const lightningAddress = UTF8_DECODER.decode(stream.readToEnd());

  return { type: 'payout_pending', amountSats, lightningAddress };
}
