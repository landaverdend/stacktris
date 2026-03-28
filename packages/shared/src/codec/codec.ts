// ── Opcodes ───────────────────────────────────────────────────────────────────
// Client → Server: 0x00–0x08
// Server → Client: 0x10–0x1E

// GENERAL STRUCTURE: [opcode: 1 byte][payload: variable length per message]

import { Message } from "../protocol.js";
import { ByteStream } from "./byteStream.js";
import { bigEndianToInteger, encodeVarInt, packActivePiece, unpackActivePiece, packBoard, unpackBoard, encodeInputAction, decodeInputAction, packPieceKind, unpackPieceKind } from "./ops.js";
import { GameFrame, SessionState, SessionStatus } from "../protocol.js";

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

// [opcode: 1 byte][id: utf8, rest of buffer]
function encodeOpcodeAndId(opcode: number, id: string): Uint8Array {
  const stream = new ByteStream();
  stream.writeInt(opcode, 1);
  stream.write(UTF8_ENCODER.encode(id));
  return stream.toBytes();
}

// payout_pending format: [opcode: 1 byte][amount: varint][invoice: utf8, rest of buffer]
export function encodeMsg(msg: Message): Uint8Array {

  switch (msg.type) {
    // Client → Server
    case 'create_room':   return new Uint8Array([MsgCode.CREATE_ROOM, ...encodeVarInt(msg.buy_in)]);
    case 'join_room':     return encodeOpcodeAndId(MsgCode.JOIN_ROOM, msg.room_id);
    case 'leave_room':    return encodeOpcodeAndId(MsgCode.LEAVE_ROOM, msg.room_id);
    case 'ready_update':  return new Uint8Array([MsgCode.READY_UPDATE, msg.ready ? 0x01 : 0x00]);
    case 'player_died':   return new Uint8Array([MsgCode.PLAYER_DIED]);
    case 'game_action': {
      const { buffer, frame } = msg;
      const out = new Uint8Array(5 + buffer.length * 2);
      out[0] = MsgCode.GAME_ACTION;
      out[1] = (frame >> 16) & 0xff;
      out[2] = (frame >> 8) & 0xff;
      out[3] = frame & 0xff;
      out[4] = buffer.length;
      for (let i = 0; i < buffer.length; i++) {
        out[5 + i * 2]     = encodeInputAction(buffer[i].action);
        out[5 + i * 2 + 1] = frame - buffer[i].frame;
      }
      return out;
    }
    case 'piece_locked': {
      const stream = new ByteStream();
      stream.writeInt(MsgCode.PIECE_LOCKED, 1);
      stream.write(packBoard(msg.board));
      return stream.toBytes();
    }
    case 'game_state_heartbeat': {
      const stream = new ByteStream();
      stream.writeInt(MsgCode.GAME_STATE_HEARTBEAT, 1);
      encodeGameFrame(msg.state, stream);
      return stream.toBytes();
    }
    case 'set_player_name': {
      const nameBytes = UTF8_ENCODER.encode(msg.name);
      const stream = new ByteStream();
      stream.writeInt(MsgCode.SET_PLAYER_NAME, 1);
      stream.writeInt(nameBytes.length, 1);
      stream.write(nameBytes);
      if (msg.lightning_address) stream.write(UTF8_ENCODER.encode(msg.lightning_address));
      return stream.toBytes();
    }

    // Server → Client
    case 'welcome':               return encodeOpcodeAndId(MsgCode.WELCOME, msg.player_id);
    case 'session_created':       return encodeOpcodeAndId(MsgCode.SESSION_CREATED, msg.room_id);
    case 'session_joined':        return encodeOpcodeAndId(MsgCode.SESSION_JOINED, msg.room_id);
    case 'gravity_update':        return new Uint8Array([MsgCode.GRAVITY_UPDATE, msg.level]);
    case 'game_start': {
      const stream = new ByteStream();
      stream.writeInt(MsgCode.GAME_START, 1);
      stream.writeInt(msg.seed, 4);
      stream.writeInt(msg.roundStartTime, 8);
      return stream.toBytes();
    }
    case 'game_state_update': {
      const stream = new ByteStream();
      stream.writeInt(MsgCode.GAME_STATE_UPDATE, 1);
      encodeGameFrame(msg.frame, stream);
      return stream.toBytes();
    }
    case 'session_state_update': {
      const stream = new ByteStream();
      stream.writeInt(MsgCode.SESSION_STATE_UPDATE, 1);
      encodeSessionState(msg.roomState, stream);
      return stream.toBytes();
    }
    case 'bet_payment_confirmed': return new Uint8Array([MsgCode.BET_PAYMENT_CONFIRMED, msg.slotIndex]);
    case 'game_player_died':      return new Uint8Array([MsgCode.GAME_PLAYER_DIED, msg.slotIndex]);
    case 'error':                 return encodeOpcodeAndId(MsgCode.ERROR, msg.message);
    case 'opponent_board_update': {
      const packed = packBoard(msg.board);
      const out = new Uint8Array(2 + packed.length);
      out[0] = MsgCode.OPPONENT_BOARD_UPDATE;
      out[1] = msg.slotIndex;
      out.set(packed, 2);
      return out;
    }
    case 'bet_invoice_issued': {
      const stream = new ByteStream();
      stream.writeInt(MsgCode.BET_INVOICE_ISSUED, 1);
      stream.writeInt(msg.expiresAt, 8);
      stream.write(UTF8_ENCODER.encode(msg.bolt11));
      return stream.toBytes();
    }
    case 'game_garbage_incoming': {
      const stream = new ByteStream();
      stream.writeInt(MsgCode.GAME_GARBAGE_INCOMING, 1);
      stream.writeInt(msg.lines, 1);
      stream.writeInt(msg.triggerFrame, 3);
      return stream.toBytes();
    }
    case 'opponent_piece_update': {
      const [b0, b1] = packActivePiece(msg.activePiece);
      return new Uint8Array([MsgCode.OPPONENT_PIECE_UPDATE, msg.slotIndex, b0, b1]);
    }
    case 'payout_pending':        return encodePayoutPending(msg);
  }

  throw new Error(`Unknown msg: ${(msg as Message).type}`);
}

export function decodeMsg(data: Uint8Array) {
  const stream = new ByteStream(data);
  const opcode = Number(stream.read(1)[0]);

  switch (opcode) {
    // Client → Server
    case MsgCode.CREATE_ROOM:  return { type: 'create_room', buy_in: stream.readVarInt() };
    case MsgCode.JOIN_ROOM:    return { type: 'join_room', room_id: UTF8_DECODER.decode(stream.readToEnd()) };
    case MsgCode.LEAVE_ROOM:   return { type: 'leave_room', room_id: UTF8_DECODER.decode(stream.readToEnd()) };
    case MsgCode.READY_UPDATE: return { type: 'ready_update', ready: stream.read(1)[0] === 0x01 };
    case MsgCode.PLAYER_DIED:  return { type: 'player_died' };
    case MsgCode.GAME_ACTION: {
      const frameBytes = stream.read(3);
      const frame = (frameBytes[0] << 16) | (frameBytes[1] << 8) | frameBytes[2];
      const count = stream.read(1)[0];
      const buffer = [];
      for (let i = 0; i < count; i++) {
        const entry = stream.read(2);
        buffer.push({ action: decodeInputAction(entry[0]), frame: frame - entry[1] });
      }
      return { type: 'game_action', buffer, frame };
    }
    case MsgCode.PIECE_LOCKED:         return { type: 'piece_locked', board: unpackBoard(stream.read(100)) };
    case MsgCode.GAME_STATE_HEARTBEAT: return { type: 'game_state_heartbeat', state: decodeGameFrame(stream) };
    case MsgCode.SET_PLAYER_NAME: {
      const nameLen = stream.read(1)[0];
      const name = UTF8_DECODER.decode(stream.read(nameLen));
      const rest = stream.readToEnd();
      const lightning_address = rest.length > 0 ? UTF8_DECODER.decode(rest) : undefined;
      return { type: 'set_player_name', name, ...(lightning_address !== undefined && { lightning_address }) };
    }

    // Server → Client
    case MsgCode.WELCOME:               return { type: 'welcome', player_id: UTF8_DECODER.decode(stream.readToEnd()) };
    case MsgCode.SESSION_CREATED:       return { type: 'session_created', room_id: UTF8_DECODER.decode(stream.readToEnd()) };
    case MsgCode.SESSION_JOINED:        return { type: 'session_joined', room_id: UTF8_DECODER.decode(stream.readToEnd()) };
    case MsgCode.GRAVITY_UPDATE:        return { type: 'gravity_update', level: stream.read(1)[0] };
    case MsgCode.GAME_START: {
      const seed = Number(bigEndianToInteger(stream.read(4)));
      const roundStartTime = Number(bigEndianToInteger(stream.read(8)));
      return { type: 'game_start', seed, roundStartTime };
    }
    case MsgCode.GAME_STATE_UPDATE:    return { type: 'game_state_update', frame: decodeGameFrame(stream) };
    case MsgCode.SESSION_STATE_UPDATE: return { type: 'session_state_update', roomState: decodeSessionState(stream) };
    case MsgCode.BET_PAYMENT_CONFIRMED: return { type: 'bet_payment_confirmed', slotIndex: stream.read(1)[0] };
    case MsgCode.GAME_PLAYER_DIED:      return { type: 'game_player_died', slotIndex: stream.read(1)[0] };
    case MsgCode.ERROR:                 return { type: 'error', message: UTF8_DECODER.decode(stream.readToEnd()) };
    case MsgCode.OPPONENT_BOARD_UPDATE: {
      const slotIndex = stream.read(1)[0];
      const board = unpackBoard(stream.read(100));
      return { type: 'opponent_board_update', slotIndex, board };
    }
    case MsgCode.BET_INVOICE_ISSUED: {
      const expiresAt = Number(bigEndianToInteger(stream.read(8)));
      const bolt11 = UTF8_DECODER.decode(stream.readToEnd());
      return { type: 'bet_invoice_issued', bolt11, expiresAt };
    }
    case MsgCode.GAME_GARBAGE_INCOMING: {
      const lines = stream.read(1)[0];
      const triggerFrame = Number(bigEndianToInteger(stream.read(3)));
      return { type: 'game_garbage_incoming', lines, triggerFrame };
    }
    case MsgCode.OPPONENT_PIECE_UPDATE: {
      const slotIndex = stream.read(1)[0];
      const [b0, b1] = stream.read(2);
      return { type: 'opponent_piece_update', slotIndex, activePiece: unpackActivePiece(b0, b1) };
    }
    case MsgCode.PAYOUT_PENDING:        return decodePayoutPending(stream);
  }

  throw new Error(`Unknown opcode: ${opcode}`);
}


// ── GameFrame helpers ─────────────────────────────────────────────────────────
// Layout: [board:100][activePiece:2][gravityLevel:4f][holdPiece:1][flags:1]
//         [bagPosition:2][frame:3][pendingCount:1][pending: 5×N]
// flags: bit0=holdUsed, bit1=isGameOver

function encodeGameFrame(f: GameFrame, stream: ByteStream): void {
  stream.write(packBoard(f.board));
  const [ap0, ap1] = packActivePiece(f.activePiece);
  stream.writeInt(ap0, 1);
  stream.writeInt(ap1, 1);
  stream.writeFloat32(f.gravityLevel);
  stream.writeInt(packPieceKind(f.holdPiece), 1);
  stream.writeInt((f.holdUsed ? 0x01 : 0x00) | (f.isGameOver ? 0x02 : 0x00), 1);
  stream.writeInt(f.bagPosition, 2);
  stream.writeInt(f.frame, 3);
  stream.writeInt(f.pendingGarbage.length, 1);
  for (const pg of f.pendingGarbage) {
    stream.writeInt(pg.lines, 1);
    stream.writeInt(pg.triggerFrame, 3);
    stream.writeInt(pg.gap, 1);
  }
}

function decodeGameFrame(stream: ByteStream): GameFrame {
  const board = unpackBoard(stream.read(100));
  const [ap0, ap1] = stream.read(2);
  const activePiece = unpackActivePiece(ap0, ap1)!;
  const gravityLevel = stream.readFloat32();
  const holdPiece = unpackPieceKind(stream.read(1)[0]);
  const flags = stream.read(1)[0];
  const holdUsed = (flags & 0x01) !== 0;
  const isGameOver = (flags & 0x02) !== 0;
  const bagPosition = Number(bigEndianToInteger(stream.read(2)));
  const frame = Number(bigEndianToInteger(stream.read(3)));
  const pendingCount = stream.read(1)[0];
  const pendingGarbage = [];
  for (let i = 0; i < pendingCount; i++) {
    const lines = stream.read(1)[0];
    const triggerFrame = Number(bigEndianToInteger(stream.read(3)));
    const gap = stream.read(1)[0];
    pendingGarbage.push({ lines, triggerFrame, gap });
  }
  return { board, activePiece, gravityLevel, holdPiece, holdUsed, isGameOver, bagPosition, frame, pendingGarbage };
}

// ── SessionState helpers ──────────────────────────────────────────────────────
// status byte: 0=waiting 1=countdown 2=playing 3=intermission 4=finished
const SESSION_STATUS_INDEX: Record<SessionStatus, number> = { waiting: 0, countdown: 1, playing: 2, intermission: 3, finished: 4 };
const SESSION_STATUSES: SessionStatus[] = ['waiting', 'countdown', 'playing', 'intermission', 'finished'];
const UUID_BYTES = 36;

function encodeSessionState(s: SessionState, stream: ByteStream): void {
  stream.writeInt(SESSION_STATUS_INDEX[s.status], 1);
  stream.write(encodeVarInt(s.buyIn));
  stream.write(encodeVarInt(s.potSats));

  const roomIdBytes = UTF8_ENCODER.encode(s.roomId);
  stream.writeInt(roomIdBytes.length, 1);
  stream.write(roomIdBytes);

  const writeNullableId = (id: string | null) => {
    if (id === null) { stream.writeInt(0, 1); }
    else { stream.writeInt(1, 1); stream.write(UTF8_ENCODER.encode(id)); }
  };
  writeNullableId(s.roundWinnerId);
  writeNullableId(s.matchWinnerId);

  stream.writeInt(s.players.length, 1);
  for (const p of s.players) {
    stream.writeInt(p.slotIndex, 1);
    stream.writeInt((p.ready ? 0x01 : 0x00) | (p.paid ? 0x02 : 0x00), 1);
    stream.writeInt(p.wins, 1);
    const nameBytes = UTF8_ENCODER.encode(p.playerName);
    stream.writeInt(nameBytes.length, 1);
    stream.write(nameBytes);
    stream.write(UTF8_ENCODER.encode(p.playerId));
  }
}

function decodeSessionState(stream: ByteStream): SessionState {
  const status = SESSION_STATUSES[stream.read(1)[0]];
  const buyIn = stream.readVarInt();
  const potSats = stream.readVarInt();

  const roomIdLen = stream.read(1)[0];
  const roomId = UTF8_DECODER.decode(stream.read(roomIdLen));

  const readNullableId = (): string | null => {
    const present = stream.read(1)[0];
    return present ? UTF8_DECODER.decode(stream.read(UUID_BYTES)) : null;
  };
  const roundWinnerId = readNullableId();
  const matchWinnerId = readNullableId();

  const playerCount = stream.read(1)[0];
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    const slotIndex = stream.read(1)[0];
    const flags = stream.read(1)[0];
    const ready = (flags & 0x01) !== 0;
    const paid = (flags & 0x02) !== 0;
    const wins = stream.read(1)[0];
    const nameLen = stream.read(1)[0];
    const playerName = UTF8_DECODER.decode(stream.read(nameLen));
    const playerId = UTF8_DECODER.decode(stream.read(UUID_BYTES));
    players.push({ playerId, slotIndex, playerName, ready, paid, wins });
  }

  return { roomId, players, status, roundWinnerId, matchWinnerId, buyIn, potSats };
}

// payout_pending format: [opcode: 1 byte][amount: varint][invoice: utf8, rest of buffer]
function encodePayoutPending(msg: { type: 'payout_pending'; amountSats: number; lightningAddress: string }): Uint8Array {
  const stream = new ByteStream();

  stream.writeInt(MsgCode.PAYOUT_PENDING, 1);
  stream.write(encodeVarInt(msg.amountSats));
  stream.write(UTF8_ENCODER.encode(msg.lightningAddress));

  return stream.toBytes();
}

function decodePayoutPending(stream: ByteStream): Message {
  const amountSats = stream.readVarInt();
  const lightningAddress = UTF8_DECODER.decode(stream.readToEnd());

  return { type: 'payout_pending', amountSats, lightningAddress };
}
