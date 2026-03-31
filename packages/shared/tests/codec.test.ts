import { describe, it, expect } from 'vitest';
import { encodeMsg, decodeMsg, MsgCode } from '../src/codec/codec.js';
import { packActivePiece, unpackActivePiece, packBoard, unpackBoard, encodeInputAction, decodeInputAction } from '../src/codec/ops.js';
import { ActivePiece } from '../src/game/types.js';
import { Board } from '../src/game/board.js';
import { GameFrame, PlayerInfo, SessionState } from '../src/protocol.js';

describe('payout_pending encode', () => {
  it('first byte is the PAYOUT_PENDING opcode', () => {
    const buf = encodeMsg({ type: 'payout_pending', amountSats: 1000, lightningAddress: 'test@wallet.com' });
    expect(buf[0]).toBe(MsgCode.PAYOUT_PENDING);
  });

  it('encodes a small amount as a single varint byte', () => {
    const buf = encodeMsg({ type: 'payout_pending', amountSats: 100, lightningAddress: 'a@b.com' });
    // 100 < 0xfd so varint is 1 byte: [opcode, 0x64, ...invoice]
    expect(buf[1]).toBe(0x64);
  });

  it('encodes a large amount with 0xfd varint prefix', () => {
    const buf = encodeMsg({ type: 'payout_pending', amountSats: 1000, lightningAddress: 'a@b.com' });
    // 1000 > 252 so varint is [0xfd, 0x03, 0xe8]
    expect(buf[1]).toBe(0xfd);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0xe8);
  });

  it('encodes the lightning address as utf-8 at the end of the buffer', () => {
    const address = 'satoshi@bitcoin.org';
    const buf = encodeMsg({ type: 'payout_pending', amountSats: 1, lightningAddress: address });
    const invoiceBytes = buf.slice(2); // opcode (1) + varint for 1 (1)
    expect(new TextDecoder().decode(invoiceBytes)).toBe(address);
  });
});

describe('payout_pending decode', () => {
  it('decodes type correctly', () => {
    const buf = encodeMsg({ type: 'payout_pending', amountSats: 500, lightningAddress: 'a@b.com' });
    const msg = decodeMsg(buf);
    expect(msg.type).toBe('payout_pending');
  });

  it('decodes the amount correctly', () => {
    const buf = encodeMsg({ type: 'payout_pending', amountSats: 500, lightningAddress: 'a@b.com' });
    const msg = decodeMsg(buf) as { type: 'payout_pending'; amountSats: number; lightningAddress: string };
    expect(msg.amountSats).toBe(500);
  });

  it('decodes the lightning address correctly', () => {
    const buf = encodeMsg({ type: 'payout_pending', amountSats: 500, lightningAddress: 'satoshi@bitcoin.org' });
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
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('create_room');
    expect(decoded.buy_in).toBe(1000);
  });

  it('create_room with zero buy_in', () => {
    const msg = { type: 'create_room' as const, buy_in: 0 };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.buy_in).toBe(0);
  });

  it('join_room', () => {
    const msg = { type: 'join_room' as const, room_id: 'room-abc' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('join_room');
    expect(decoded.room_id).toBe('room-abc');
  });

  it('leave_room', () => {
    const msg = { type: 'leave_room' as const, room_id: 'room-abc' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('leave_room');
    expect(decoded.room_id).toBe('room-abc');
  });

  it('ready_update true', () => {
    const msg = { type: 'ready_update' as const, ready: true };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('ready_update');
    expect(decoded.ready).toBe(true);
  });

  it('ready_update false', () => {
    const msg = { type: 'ready_update' as const, ready: false };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.ready).toBe(false);
  });

  it('player_died has no payload', () => {
    const msg = { type: 'player_died' as const };
    const buf = encodeMsg(msg);
    expect(buf.length).toBe(1);
    expect(buf[0]).toBe(MsgCode.PLAYER_DIED);
    expect(decodeMsg(buf)).toEqual({ type: 'player_died' });
  });

  it('first byte is always the correct opcode', () => {
    expect(encodeMsg({ type: 'create_room', buy_in: 0 })[0]).toBe(MsgCode.CREATE_ROOM);
    expect(encodeMsg({ type: 'join_room', room_id: 'x' })[0]).toBe(MsgCode.JOIN_ROOM);
    expect(encodeMsg({ type: 'leave_room', room_id: 'x' })[0]).toBe(MsgCode.LEAVE_ROOM);
    expect(encodeMsg({ type: 'ready_update', ready: true })[0]).toBe(MsgCode.READY_UPDATE);
    expect(encodeMsg({ type: 'player_died' })[0]).toBe(MsgCode.PLAYER_DIED);
  });
});

describe('opcode + id round-trips', () => {
  it('welcome', () => {
    const msg = { type: 'welcome' as const, player_id: 'abc-123' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('welcome');
    expect(decoded.player_id).toBe('abc-123');
  });

  it('session_created', () => {
    const msg = { type: 'session_created' as const, room_id: 'room-xyz' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('session_created');
    expect(decoded.room_id).toBe('room-xyz');
  });

  it('session_joined', () => {
    const msg = { type: 'session_joined' as const, room_id: 'room-xyz' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('session_joined');
    expect(decoded.room_id).toBe('room-xyz');
  });

  it('bet_payment_confirmed', () => {
    const msg = { type: 'bet_payment_confirmed' as const, slotIndex: 3 };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('bet_payment_confirmed');
    expect(decoded.slotIndex).toBe(3);
  });

  it('game_player_died', () => {
    const msg = { type: 'game_player_died' as const, slotIndex: 5 };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('game_player_died');
    expect(decoded.slotIndex).toBe(5);
  });

  it('error', () => {
    const msg = { type: 'error' as const, message: 'something went wrong' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('error');
    expect(decoded.message).toBe('something went wrong');
  });

  it('first byte is always the correct opcode', () => {
    expect(encodeMsg({ type: 'welcome', player_id: 'x' })[0]).toBe(MsgCode.WELCOME);
    expect(encodeMsg({ type: 'session_created', room_id: 'x' })[0]).toBe(MsgCode.SESSION_CREATED);
    expect(encodeMsg({ type: 'session_joined', room_id: 'x' })[0]).toBe(MsgCode.SESSION_JOINED);
    expect(encodeMsg({ type: 'bet_payment_confirmed', slotIndex: 0 })[0]).toBe(MsgCode.BET_PAYMENT_CONFIRMED);
    expect(encodeMsg({ type: 'game_player_died', slotIndex: 0 })[0]).toBe(MsgCode.GAME_PLAYER_DIED);
    expect(encodeMsg({ type: 'error', message: 'x' })[0]).toBe(MsgCode.ERROR);
  });
});

const makeEmptyBoard = (): Board => Array.from({ length: 22 }, () => new Array(10).fill(0));

describe('packBoard / unpackBoard', () => {
  it('packs to exactly 100 bytes', () => {
    expect(packBoard(makeEmptyBoard()).length).toBe(100);
  });

  it('round-trips an empty board', () => {
    const board = makeEmptyBoard();
    const result = unpackBoard(packBoard(board));
    expect(result).toEqual(board);
  });

  it('round-trips a board with cell values 0–8 in visible rows', () => {
    const board = makeEmptyBoard();
    // fill visible rows (rows 2–21) with values cycling 0–8
    for (let r = 2; r < 22; r++) {
      for (let c = 0; c < 10; c++) {
        board[r][c] = (r * 10 + c) % 9;
      }
    }
    const result = unpackBoard(packBoard(board));
    expect(result).toEqual(board);
  });

  it('preserves the 2 invisible buffer rows as empty after unpack', () => {
    const board = makeEmptyBoard();
    board[0] = new Array(10).fill(5); // buffer row — should not survive round-trip
    board[1] = new Array(10).fill(3);
    const result = unpackBoard(packBoard(board));
    expect(result[0]).toEqual(new Array(10).fill(0));
    expect(result[1]).toEqual(new Array(10).fill(0));
  });

  it('round-trips all cell values 0–8', () => {
    const board = makeEmptyBoard();
    for (let c = 0; c < 9; c++) board[2][c] = c; // 0-8 in first visible row
    board[2][9] = 0;
    const result = unpackBoard(packBoard(board));
    for (let c = 0; c < 9; c++) expect(result[2][c]).toBe(c);
  });

  it('returns a 22-row board', () => {
    expect(unpackBoard(packBoard(makeEmptyBoard())).length).toBe(22);
  });

  it('each row has 10 columns', () => {
    const result = unpackBoard(packBoard(makeEmptyBoard()));
    for (const row of result) expect(row.length).toBe(10);
  });
});

describe('opponent_board_update encode/decode', () => {
  it('first byte is the OPPONENT_BOARD_UPDATE opcode', () => {
    const buf = encodeMsg({ type: 'opponent_board_update', slotIndex: 0, board: makeEmptyBoard() });
    expect(buf[0]).toBe(MsgCode.OPPONENT_BOARD_UPDATE);
  });

  it('second byte is the slotIndex', () => {
    const buf = encodeMsg({ type: 'opponent_board_update', slotIndex: 5, board: makeEmptyBoard() });
    expect(buf[1]).toBe(5);
  });

  it('total length is 102 bytes', () => {
    const buf = encodeMsg({ type: 'opponent_board_update', slotIndex: 0, board: makeEmptyBoard() });
    expect(buf.length).toBe(102);
  });

  it('round-trips an empty board', () => {
    const msg = { type: 'opponent_board_update' as const, slotIndex: 3, board: makeEmptyBoard() };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('opponent_board_update');
    expect(decoded.slotIndex).toBe(3);
    expect(decoded.board).toEqual(makeEmptyBoard());
  });

  it('round-trips a board with cell data', () => {
    const board = makeEmptyBoard();
    for (let r = 2; r < 22; r++)
      for (let c = 0; c < 10; c++)
        board[r][c] = (r + c) % 9;
    const msg = { type: 'opponent_board_update' as const, slotIndex: 1, board };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    // visible rows preserved
    for (let r = 2; r < 22; r++)
      for (let c = 0; c < 10; c++)
        expect(decoded.board[r][c]).toBe(board[r][c]);
  });
});

describe('packActivePiece / unpackActivePiece', () => {
  const base: ActivePiece = { kind: 'I', row: 0, col: 0, rotation: 0, isFloored: false, timeOnFloor: 0, highestRowIndex: 0, totalResets: 0 };

  it('packs null to kind index 7', () => {
    const [b0] = packActivePiece(null);
    expect((b0 >> 5) & 0x7).toBe(7); // top 3 bits of first byte = kind
  });

  it('unpacks null sentinel back to null', () => {
    const [b0, b1] = packActivePiece(null);
    expect(unpackActivePiece(b0, b1)).toBeNull();
  });

  it('round-trips every piece kind', () => {
    const kinds = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
    for (const kind of kinds) {
      const piece: ActivePiece = { ...base, kind };
      const [b0, b1] = packActivePiece(piece);
      expect(unpackActivePiece(b0, b1)?.kind).toBe(kind);
    }
  });

  it('round-trips all rotations', () => {
    for (const rotation of [0, 1, 2, 3]) {
      const piece: ActivePiece = { ...base, kind: 'T', rotation };
      const [b0, b1] = packActivePiece(piece);
      expect(unpackActivePiece(b0, b1)?.rotation).toBe(rotation);
    }
  });

  it('round-trips col 0 through 9', () => {
    for (let col = 0; col <= 9; col++) {
      const piece: ActivePiece = { ...base, kind: 'S', col };
      const [b0, b1] = packActivePiece(piece);
      expect(unpackActivePiece(b0, b1)?.col).toBe(col);
    }
  });

  it('round-trips row 0 through 21', () => {
    for (let row = 0; row <= 21; row++) {
      const piece: ActivePiece = { ...base, kind: 'J', row };
      const [b0, b1] = packActivePiece(piece);
      expect(unpackActivePiece(b0, b1)?.row).toBe(row);
    }
  });

  it('round-trips a fully specified piece', () => {
    const piece: ActivePiece = { ...base, kind: 'L', row: 18, col: 7, rotation: 3 };
    const [b0, b1] = packActivePiece(piece);
    const out = unpackActivePiece(b0, b1)!;
    expect(out.kind).toBe('L');
    expect(out.row).toBe(18);
    expect(out.col).toBe(7);
    expect(out.rotation).toBe(3);
  });

  it('packs to exactly 2 bytes', () => {
    const [b0, b1] = packActivePiece({ ...base, kind: 'Z', row: 10, col: 5, rotation: 2 });
    expect(b0).toBeGreaterThanOrEqual(0);
    expect(b0).toBeLessThanOrEqual(255);
    expect(b1).toBeGreaterThanOrEqual(0);
    expect(b1).toBeLessThanOrEqual(255);
  });
});

describe('opponent_piece_update encode/decode', () => {
  const base: ActivePiece = { kind: 'T', row: 5, col: 4, rotation: 1, isFloored: false, timeOnFloor: 0, highestRowIndex: 0, totalResets: 0 };

  it('first byte is the OPPONENT_PIECE_UPDATE opcode', () => {
    const buf = encodeMsg({ type: 'opponent_piece_update', slotIndex: 0, activePiece: base });
    expect(buf[0]).toBe(MsgCode.OPPONENT_PIECE_UPDATE);
  });

  it('second byte is the slotIndex', () => {
    const buf = encodeMsg({ type: 'opponent_piece_update', slotIndex: 3, activePiece: base });
    expect(buf[1]).toBe(3);
  });

  it('total length is 4 bytes', () => {
    const buf = encodeMsg({ type: 'opponent_piece_update', slotIndex: 0, activePiece: base });
    expect(buf.length).toBe(4);
  });

  it('encodes null activePiece as 4 bytes', () => {
    const buf = encodeMsg({ type: 'opponent_piece_update', slotIndex: 1, activePiece: null });
    expect(buf.length).toBe(4);
    expect(buf[0]).toBe(MsgCode.OPPONENT_PIECE_UPDATE);
  });

  it('round-trips a piece', () => {
    const msg = { type: 'opponent_piece_update' as const, slotIndex: 2, activePiece: base };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('opponent_piece_update');
    expect(decoded.slotIndex).toBe(2);
    expect(decoded.activePiece?.kind).toBe('T');
    expect(decoded.activePiece?.row).toBe(5);
    expect(decoded.activePiece?.col).toBe(4);
    expect(decoded.activePiece?.rotation).toBe(1);
  });

  it('round-trips null activePiece', () => {
    const msg = { type: 'opponent_piece_update' as const, slotIndex: 0, activePiece: null };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.activePiece).toBeNull();
  });

  it('round-trips all slot indices 0-7', () => {
    for (let slot = 0; slot <= 7; slot++) {
      const msg = { type: 'opponent_piece_update' as const, slotIndex: slot, activePiece: base };
      const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
      expect(decoded.slotIndex).toBe(slot);
    }
  });
});

describe('encodeInputAction / decodeInputAction', () => {
  const actions = ['move_left', 'move_right', 'rotate_cw', 'rotate_ccw', 'move_down', 'soft_drop', 'hard_drop', 'hold'] as const;

  it('encodes every action to a unique index 0-7', () => {
    const indices = actions.map(encodeInputAction);
    expect(new Set(indices).size).toBe(8);
    expect(Math.min(...indices)).toBe(0);
    expect(Math.max(...indices)).toBe(7);
  });

  it('round-trips every action', () => {
    for (const action of actions) {
      expect(decodeInputAction(encodeInputAction(action))).toBe(action);
    }
  });

  it('throws on an unknown index', () => {
    expect(() => decodeInputAction(99)).toThrow();
  });
});

describe('game_action encode/decode', () => {
  it('first byte is the GAME_ACTION opcode', () => {
    const buf = encodeMsg({ type: 'game_action', frame: 100, buffer: [] });
    expect(buf[0]).toBe(MsgCode.GAME_ACTION);
  });

  it('empty buffer encodes to 5 bytes', () => {
    const buf = encodeMsg({ type: 'game_action', frame: 0, buffer: [] });
    expect(buf.length).toBe(5);
  });

  it('each buffer entry adds 2 bytes', () => {
    const buf = encodeMsg({ type: 'game_action', frame: 10, buffer: [
      { action: 'move_left', frame: 10 },
      { action: 'rotate_cw', frame: 9 },
      { action: 'hard_drop', frame: 8 },
    ]});
    expect(buf.length).toBe(5 + 3 * 2);
  });

  it('round-trips an empty buffer', () => {
    const msg = { type: 'game_action' as const, frame: 500, buffer: [] };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('game_action');
    expect(decoded.frame).toBe(500);
    expect(decoded.buffer).toEqual([]);
  });

  it('round-trips all 8 action types', () => {
    const actions = ['move_left', 'move_right', 'rotate_cw', 'rotate_ccw', 'move_down', 'soft_drop', 'hard_drop', 'hold'] as const;
    const buffer = actions.map((action, i) => ({ action, frame: 100 - i }));
    const msg = { type: 'game_action' as const, frame: 100, buffer };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.buffer.map(e => e.action)).toEqual(actions);
  });

  it('round-trips frame numbers correctly using delta encoding', () => {
    const msg = { type: 'game_action' as const, frame: 1000, buffer: [
      { action: 'move_left' as const, frame: 1000 },
      { action: 'move_right' as const, frame: 995 },
      { action: 'hard_drop' as const, frame: 980 },
    ]};
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.buffer[0].frame).toBe(1000);
    expect(decoded.buffer[1].frame).toBe(995);
    expect(decoded.buffer[2].frame).toBe(980);
  });

  it('round-trips a large top-level frame', () => {
    const msg = { type: 'game_action' as const, frame: 16_000_000, buffer: [{ action: 'hold' as const, frame: 16_000_000 }] };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.frame).toBe(16_000_000);
    expect(decoded.buffer[0].frame).toBe(16_000_000);
  });
});

describe('set_player_name encode/decode', () => {
  it('first byte is the SET_PLAYER_NAME opcode', () => {
    const buf = encodeMsg({ type: 'set_player_name', name: 'alice' });
    expect(buf[0]).toBe(MsgCode.SET_PLAYER_NAME);
  });

  it('round-trips name without lightning address', () => {
    const msg = { type: 'set_player_name' as const, name: 'alice' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('set_player_name');
    expect(decoded.name).toBe('alice');
  });

  it('round-trips name with lightning address', () => {
    const msg = { type: 'set_player_name' as const, name: 'bob', lightning_address: 'bob@wallet.io' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.name).toBe('bob');
    expect(decoded.lightning_address).toBe('bob@wallet.io');
  });

  it('handles names with unicode characters', () => {
    const msg = { type: 'set_player_name' as const, name: 'テトリス' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.name).toBe('テトリス');
  });
});

describe('bet_invoice_issued encode/decode', () => {
  it('first byte is the BET_INVOICE_ISSUED opcode', () => {
    const buf = encodeMsg({ type: 'bet_invoice_issued', bolt11: 'lnbc...', expiresAt: 1000 });
    expect(buf[0]).toBe(MsgCode.BET_INVOICE_ISSUED);
  });

  it('round-trips bolt11 and expiresAt', () => {
    const msg = { type: 'bet_invoice_issued' as const, bolt11: 'lnbc100u1ptest', expiresAt: 1743000000000 };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('bet_invoice_issued');
    expect(decoded.bolt11).toBe('lnbc100u1ptest');
    expect(decoded.expiresAt).toBe(1743000000000);
  });

  it('handles a long bolt11 invoice string', () => {
    const bolt11 = 'lnbc' + 'a'.repeat(200);
    const msg = { type: 'bet_invoice_issued' as const, bolt11, expiresAt: 9999999999999 };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.bolt11).toBe(bolt11);
    expect(decoded.expiresAt).toBe(9999999999999);
  });
});

describe('garbage_queue_sync encode/decode', () => {
  it('first byte is the GARBAGE_QUEUE_SYNC opcode', () => {
    const buf = encodeMsg({ type: 'garbage_queue_sync', queue: [] });
    expect(buf[0]).toBe(MsgCode.GARBAGE_QUEUE_SYNC);
  });

  it('encodes an empty queue as 2 bytes', () => {
    const buf = encodeMsg({ type: 'garbage_queue_sync', queue: [] });
    expect(buf.length).toBe(2); // opcode + count(0)
  });

  it('round-trips a single entry', () => {
    const msg = { type: 'garbage_queue_sync' as const, queue: [{ lines: 4, triggerFrame: 3600, gap: 7 }] };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('garbage_queue_sync');
    expect(decoded.queue).toHaveLength(1);
    expect(decoded.queue[0]).toEqual({ lines: 4, triggerFrame: 3600, gap: 7 });
  });

  it('round-trips multiple entries', () => {
    const queue = [
      { lines: 2, triggerFrame: 1200, gap: 3 },
      { lines: 4, triggerFrame: 3600, gap: 9 },
    ];
    const decoded = decodeMsg(encodeMsg({ type: 'garbage_queue_sync', queue })) as { type: 'garbage_queue_sync', queue: typeof queue };
    expect(decoded.queue).toEqual(queue);
  });

  it('round-trips a large triggerFrame', () => {
    const msg = { type: 'garbage_queue_sync' as const, queue: [{ lines: 2, triggerFrame: 16_000_000, gap: 0 }] };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.queue[0].triggerFrame).toBe(16_000_000);
  });
});

describe('payout_pending round-trip', () => {
  it('round-trips a small amount', () => {
    const msg = { type: 'payout_pending' as const, amountSats: 21, lightningAddress: 'user@wallet.io' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.amountSats).toBe(msg.amountSats);
    expect(decoded.lightningAddress).toBe(msg.lightningAddress);
  });

  it('round-trips a large amount', () => {
    const msg = { type: 'payout_pending' as const, amountSats: 1_000_000, lightningAddress: 'winner@lightning.node' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.amountSats).toBe(msg.amountSats);
    expect(decoded.lightningAddress).toBe(msg.lightningAddress);
  });

  it('round-trips a lightning address with special characters', () => {
    const msg = { type: 'payout_pending' as const, amountSats: 500, lightningAddress: 'user+test@my-node.btc.org' };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.lightningAddress).toBe(msg.lightningAddress);
  });
});

// ── Shared test fixtures ──────────────────────────────────────────────────────

const BASE_ACTIVE_PIECE: ActivePiece = {
  kind: 'T', row: 5, col: 4, rotation: 1,
  isFloored: false, timeOnFloor: 0, highestRowIndex: 0, totalResets: 0,
};

const makeEmptyGameFrame = (): GameFrame => ({
  board: makeEmptyBoard(),
  activePiece: BASE_ACTIVE_PIECE,
  gravityLevel: 0.02,
  holdPiece: null,
  holdUsed: false,
  isGameOver: false,
  bagPosition: 12,
  frame: 600,
  pendingGarbage: [],
});

const makePlayer = (overrides: Partial<PlayerInfo> = {}): PlayerInfo => ({
  playerId: '00000000-0000-0000-0000-000000000001',
  slotIndex: 0,
  playerName: 'alice',
  ready: false,
  paid: true,
  wins: 1,
  ...overrides,
});

const makeSessionState = (overrides: Partial<SessionState> = {}): SessionState => ({
  roomId: 'ABCDE',
  players: [makePlayer()],
  status: 'playing',
  roundWinnerId: null,
  matchWinnerId: null,
  buyIn: 0,
  potSats: 0,
  ...overrides,
});

// ── game_start ────────────────────────────────────────────────────────────────

describe('game_start encode/decode', () => {
  it('encodes to 13 bytes', () => {
    expect(encodeMsg({ type: 'game_start', seed: 0, roundStartTime: 0 }).length).toBe(13);
  });

  it('first byte is the GAME_START opcode', () => {
    expect(encodeMsg({ type: 'game_start', seed: 0, roundStartTime: 0 })[0]).toBe(MsgCode.GAME_START);
  });

  it('round-trips seed and roundStartTime', () => {
    const msg = { type: 'game_start' as const, seed: 0xdeadbeef, roundStartTime: 1_743_000_000_000 };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.seed).toBe(0xdeadbeef);
    expect(decoded.roundStartTime).toBe(1_743_000_000_000);
  });
});

// ── piece_locked ──────────────────────────────────────────────────────────────

describe('piece_locked encode/decode', () => {
  it('encodes to 101 bytes', () => {
    expect(encodeMsg({ type: 'piece_locked', board: makeEmptyBoard() }).length).toBe(101);
  });

  it('first byte is the PIECE_LOCKED opcode', () => {
    expect(encodeMsg({ type: 'piece_locked', board: makeEmptyBoard() })[0]).toBe(MsgCode.PIECE_LOCKED);
  });

  it('round-trips the board', () => {
    const board = makeEmptyBoard();
    board[5][3] = 2;
    board[21][9] = 7;
    const decoded = decodeMsg(encodeMsg({ type: 'piece_locked', board })) as { type: string; board: Board };
    expect(decoded.board[5][3]).toBe(2);
    expect(decoded.board[21][9]).toBe(7);
  });
});

// ── GameFrame (shared by game_state_update / game_state_heartbeat) ────────────

describe('game_state_update encode/decode', () => {
  it('first byte is the GAME_STATE_UPDATE opcode', () => {
    expect(encodeMsg({ type: 'game_state_update', frame: makeEmptyGameFrame() })[0]).toBe(MsgCode.GAME_STATE_UPDATE);
  });

  it('round-trips a minimal GameFrame', () => {
    const msg = { type: 'game_state_update' as const, frame: makeEmptyGameFrame() };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.type).toBe('game_state_update');
    expect(decoded.frame.gravityLevel).toBeCloseTo(0.02, 5);
    expect(decoded.frame.frame).toBe(600);
    expect(decoded.frame.bagPosition).toBe(12);
    expect(decoded.frame.holdPiece).toBeNull();
    expect(decoded.frame.holdUsed).toBe(false);
    expect(decoded.frame.isGameOver).toBe(false);
    expect(decoded.frame.pendingGarbage).toEqual([]);
  });

  it('round-trips holdPiece for all kinds', () => {
    for (const kind of ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const) {
      const f = { ...makeEmptyGameFrame(), holdPiece: kind };
      const decoded = decodeMsg(encodeMsg({ type: 'game_state_update', frame: f })) as { type: string; frame: GameFrame };
      expect(decoded.frame.holdPiece).toBe(kind);
    }
  });

  it('round-trips holdUsed and isGameOver flags', () => {
    const f = { ...makeEmptyGameFrame(), holdUsed: true, isGameOver: true };
    const decoded = decodeMsg(encodeMsg({ type: 'game_state_update', frame: f })) as { type: string; frame: GameFrame };
    expect(decoded.frame.holdUsed).toBe(true);
    expect(decoded.frame.isGameOver).toBe(true);
  });

  it('round-trips pendingGarbage entries', () => {
    const f = {
      ...makeEmptyGameFrame(),
      pendingGarbage: [
        { lines: 2, triggerFrame: 500, gap: 3 },
        { lines: 4, triggerFrame: 520, gap: 7 },
      ],
    };
    const decoded = decodeMsg(encodeMsg({ type: 'game_state_update', frame: f })) as { type: string; frame: GameFrame };
    expect(decoded.frame.pendingGarbage).toEqual(f.pendingGarbage);
  });

  it('round-trips board cell data', () => {
    const board = makeEmptyBoard();
    board[10][5] = 6;
    board[21][0] = 8;
    const f = { ...makeEmptyGameFrame(), board };
    const decoded = decodeMsg(encodeMsg({ type: 'game_state_update', frame: f })) as { type: string; frame: GameFrame };
    expect(decoded.frame.board[10][5]).toBe(6);
    expect(decoded.frame.board[21][0]).toBe(8);
  });

  it('round-trips activePiece', () => {
    const f = { ...makeEmptyGameFrame(), activePiece: { ...BASE_ACTIVE_PIECE, kind: 'L' as const, row: 18, col: 7, rotation: 3 } };
    const decoded = decodeMsg(encodeMsg({ type: 'game_state_update', frame: f })) as { type: string; frame: GameFrame };
    expect(decoded.frame.activePiece.kind).toBe('L');
    expect(decoded.frame.activePiece.row).toBe(18);
    expect(decoded.frame.activePiece.col).toBe(7);
    expect(decoded.frame.activePiece.rotation).toBe(3);
  });
});

describe('game_state_heartbeat encode/decode', () => {
  it('first byte is the GAME_STATE_HEARTBEAT opcode', () => {
    expect(encodeMsg({ type: 'game_state_heartbeat', state: makeEmptyGameFrame() })[0]).toBe(MsgCode.GAME_STATE_HEARTBEAT);
  });

  it('round-trips the GameFrame', () => {
    const f = { ...makeEmptyGameFrame(), gravityLevel: 0.05, frame: 9999 };
    const msg = { type: 'game_state_heartbeat' as const, state: f };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.state.gravityLevel).toBeCloseTo(0.05, 5);
    expect(decoded.state.frame).toBe(9999);
  });
});

// ── session_state_update ──────────────────────────────────────────────────────

describe('session_state_update encode/decode', () => {
  it('first byte is the SESSION_STATE_UPDATE opcode', () => {
    const buf = encodeMsg({ type: 'session_state_update', roomState: makeSessionState() });
    expect(buf[0]).toBe(MsgCode.SESSION_STATE_UPDATE);
  });

  it('round-trips status for all values', () => {
    for (const status of ['waiting', 'countdown', 'playing', 'intermission', 'finished'] as const) {
      const decoded = decodeMsg(encodeMsg({ type: 'session_state_update', roomState: makeSessionState({ status }) })) as { type: string; roomState: SessionState };
      expect(decoded.roomState.status).toBe(status);
    }
  });

  it('round-trips buyIn and potSats', () => {
    const msg = { type: 'session_state_update' as const, roomState: makeSessionState({ buyIn: 1000, potSats: 3000 }) };
    const decoded = decodeMsg(encodeMsg(msg)) as typeof msg;
    expect(decoded.roomState.buyIn).toBe(1000);
    expect(decoded.roomState.potSats).toBe(3000);
  });

  it('round-trips roomId', () => {
    const decoded = decodeMsg(encodeMsg({ type: 'session_state_update', roomState: makeSessionState({ roomId: 'XYZAB' }) })) as { type: string; roomState: SessionState };
    expect(decoded.roomState.roomId).toBe('XYZAB');
  });

  it('round-trips null roundWinnerId and matchWinnerId', () => {
    const decoded = decodeMsg(encodeMsg({ type: 'session_state_update', roomState: makeSessionState() })) as { type: string; roomState: SessionState };
    expect(decoded.roomState.roundWinnerId).toBeNull();
    expect(decoded.roomState.matchWinnerId).toBeNull();
  });

  it('round-trips non-null roundWinnerId and matchWinnerId', () => {
    const id = '00000000-0000-0000-0000-000000000042';
    const state = makeSessionState({ roundWinnerId: id, matchWinnerId: id });
    const decoded = decodeMsg(encodeMsg({ type: 'session_state_update', roomState: state })) as { type: string; roomState: SessionState };
    expect(decoded.roomState.roundWinnerId).toBe(id);
    expect(decoded.roomState.matchWinnerId).toBe(id);
  });

  it('round-trips player fields', () => {
    const player = makePlayer({ slotIndex: 2, playerName: 'bob', ready: true, paid: false, wins: 2 });
    const decoded = decodeMsg(encodeMsg({ type: 'session_state_update', roomState: makeSessionState({ players: [player] }) })) as { type: string; roomState: SessionState };
    const p = decoded.roomState.players[0];
    expect(p.slotIndex).toBe(2);
    expect(p.playerName).toBe('bob');
    expect(p.ready).toBe(true);
    expect(p.paid).toBe(false);
    expect(p.wins).toBe(2);
  });

  it('round-trips playerId for each player', () => {
    const id = '00000000-0000-0000-0000-000000000099';
    const player = makePlayer({ playerId: id });
    const decoded = decodeMsg(encodeMsg({ type: 'session_state_update', roomState: makeSessionState({ players: [player] }) })) as { type: string; roomState: SessionState };
    expect(decoded.roomState.players[0].playerId).toBe(id);
  });

  it('round-trips multiple players', () => {
    const p1 = makePlayer({ slotIndex: 0, playerName: 'alice', playerId: '00000000-0000-0000-0000-000000000001' });
    const p2 = makePlayer({ slotIndex: 1, playerName: 'bob',   playerId: '00000000-0000-0000-0000-000000000002' });
    const decoded = decodeMsg(encodeMsg({ type: 'session_state_update', roomState: makeSessionState({ players: [p1, p2] }) })) as { type: string; roomState: SessionState };
    expect(decoded.roomState.players.length).toBe(2);
    expect(decoded.roomState.players[0].playerName).toBe('alice');
    expect(decoded.roomState.players[1].playerName).toBe('bob');
  });
});
