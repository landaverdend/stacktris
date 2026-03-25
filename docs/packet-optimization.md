# WebSocket Packet Optimization

Current baseline (2 players, 10-frame flush interval):
- **35 B upstream** — `game_action` (input buffer + frame)
- **169 B downstream** — `opponent_piece_update` (active piece + playerId + type string)
- **~6 messages/sec** per player

Not a problem at current scale. Notes here for when it matters.

---

## 1. Numeric opcodes instead of string types

MessagePack still encodes the full type string on every message.
`"opponent_piece_update"` alone is 21 bytes.

Replace with a 1-byte integer opcode:

```ts
const Opcode = {
  GAME_ACTION:            0x01,
  OPPONENT_PIECE_UPDATE:  0x02,
  OPPONENT_BOARD_UPDATE:  0x03,
  GAME_GARBAGE_INCOMING:  0x04,
  // ...
} as const;
```

**Saves ~15-25 bytes per message.**

---

## 2. Player slot instead of playerId string

UUID strings are 36 bytes. At session join, assign each player a slot index (0–3).
Every subsequent message references the slot as a single byte.

**Saves ~35 bytes on every message that includes a playerId.**

---

## 3. Pack ActivePiece into 2 bytes

The full piece state fits in 14 bits:

```
kind:     7 pieces  → 3 bits  (I/O/T/S/Z/J/L)
rotation: 0–3       → 2 bits
col:      0–9       → 4 bits
row:      0–21      → 5 bits
─────────────────────────────
total:              14 bits → 2 bytes
```

Encode/decode with a `DataView` or bitwise ops on a `Uint8Array`.

**Saves ~20+ bytes vs a MessagePack object with named fields.**

---

## 4. Key state snapshot instead of input log

Currently: an array of `{ action: string, frame: number }` events accumulated over N frames.
Alternative: send a **bitmask of currently held keys** + a frame counter.

```
8 inputs → 1 byte bitmask
frame    → 3 bytes (supports ~16M frames / ~75 hours at 60fps)
─────────────────────────
total:     4 bytes per update
```

This is the jstris approach. Simpler server-side processing too — no array to iterate,
just apply the current key state at the given frame.

**Reduces upstream messages to a fixed 4 bytes regardless of input activity.**

---

## 5. Drop MessagePack, write a custom binary codec

Once messages have fixed layouts, MessagePack only adds overhead (type tags, field length
prefixes, string encoding for keys). A custom `DataView`-based encoder/decoder for the
handful of message types in the protocol would be ~50 lines and eliminate all framing overhead.

---

## Combined result

With changes 1–3, `opponent_piece_update` goes from **169 B → ~4 bytes**:
```
1 byte  opcode
1 byte  player slot
2 bytes packed piece
```

With change 4, `game_action` goes from **~35 B → 4 bytes** fixed.

---

## When to care

At 2–8 players, 6 updates/sec, current bandwidth is well under 1 KB/s per player.
Server fanout scales linearly: each player's update goes to N-1 others, so at 8 players
you're at ~7x server egress vs 2 players — still negligible at these message sizes.

Revisit if sessions scale beyond ~20 concurrent players or if mobile clients on poor
connections become a target.
