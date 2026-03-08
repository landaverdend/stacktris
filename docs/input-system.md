# Input System Design

## On sequence numbers

The short answer: we don't need them, and here's why.

Sequence numbers matter in two scenarios:

1. **Out-of-order delivery** — packets arriving in the wrong order. WebSocket runs over TCP,
   which guarantees ordered delivery within a connection. If input A was sent before input B,
   the server will always receive A before B. Sequencing buys us nothing here.

2. **Client-side prediction** — the client predicts its own move immediately (no network wait),
   then reconciles against the server's authoritative state when the ack arrives. For this to
   work correctly, the client needs to match its prediction to the server's response using a
   sequence number. We are not doing client prediction — the server is authoritative and the
   client just renders what the server sends back.

The only future scenario where sequencing would help is **reconnection**: on reconnect you want
to know which inputs the server already processed so you don't re-send them. But reconnect
recovery is a full `GameState` broadcast, not input replay, so that doesn't need seqnums either.

**Decision: no sequence numbers for now.** The wire protocol comment already notes that clients
can freely repeat inputs (DAS), which confirms we treat inputs as fire-and-forget commands, not
an ordered log.

---

## When to apply inputs

Two options:

- **Buffer on arrival, flush at tick start** — inputs sit in a queue, processed at the top of
  each gravity tick before the piece drops. Clean determinism, but adds up to one full tick of
  latency (~100–500ms at early levels). Feels bad.

- **Apply immediately on receipt** — as soon as the server receives a `GameAction`, it processes
  it, updates the piece position, and sends back a `PieceMoved`. No buffering delay.

Immediate application is the right call. WebSocket latency is low, we have no client prediction
to reconcile, and Tetris input must feel instant. The tick loop only handles gravity; inputs
are an independent event stream.

---

## What each action does

| Action       | Effect                                                                 |
|--------------|------------------------------------------------------------------------|
| `MoveLeft`   | Shift active piece left by 1 col if valid                              |
| `MoveRight`  | Shift active piece right by 1 col if valid                             |
| `RotateCw`   | Rotate piece 90° clockwise (+ SRS wall kicks eventually)               |
| `RotateCcw`  | Rotate piece 90° counter-clockwise (+ SRS wall kicks eventually)       |
| `SoftDrop`   | Move piece down 1 row immediately (same as one gravity tick)           |
| `HardDrop`   | Drop piece instantly to ghost position, lock, spawn next, broadcast    |
| `Hold`       | Swap active piece with held piece (or hold if slot empty) — deferred   |

SRS (Super Rotation System) wall kicks are the standard kick table for when a rotation would
collide — the piece tries a series of offsets before failing. Not blocking for now; we can ship
basic rotation first and add kick tables after.

---

## Module structure

```
backend/src/game/
  input.rs      <- pure functions: try_move_left, try_move_right, try_rotate
  logic.rs      <- existing: try_move_down, lock_piece, clear_lines, is_valid
  session.rs    <- apply_input(player_i, action) -> InputResult
```

`input.rs` follows the same pattern as `logic.rs`: pure functions that take the board and
current piece and return a new piece (or None on collision). No state mutation — just collision-
checked transformations.

```rust
pub fn try_move_left(board: &Board, piece: &ActivePiece) -> Option<ActivePiece>
pub fn try_move_right(board: &Board, piece: &ActivePiece) -> Option<ActivePiece>
pub fn try_rotate_cw(board: &Board, piece: &ActivePiece) -> Option<ActivePiece>
pub fn try_rotate_ccw(board: &Board, piece: &ActivePiece) -> Option<ActivePiece>
```

`HardDrop` is slightly special — it collapses the piece to the ghost row and immediately locks
(same code path as a natural lock in `tick_player`). The result is a `PieceLocked` event, which
triggers a full `GameState` broadcast just like gravity-based locking does.

`GameSession` gets one new method:

```rust
pub fn apply_input(&mut self, player_i: usize, action: GameAction) -> InputResult
```

Where `InputResult` is either `PieceMoved` (piece shifted or rotated) or `PieceLocked` (hard
drop). `RoomActor` maps these directly to the same `ServerMsg` variants it already handles from
the tick loop.

---

## RoomActor's role

`RoomActor` is pure wiring:

```
ClientMsg::GameAction { action }
  -> figure out which player sent it (by player_id)
  -> game.apply_input(player_i, action)
  -> match InputResult:
       PieceMoved  -> send PieceMoved to that player only
       PieceLocked -> broadcast_state() to both players
```

This is the same dispatch logic already used for tick events. `RoomActor` does not know about
rotation, collision, or locking — all of that stays inside `GameSession` and `input.rs`.

---

## DAS (Delayed Auto Shift)

Standard Tetris auto-repeat: hold left/right, the piece initially moves once, pauses briefly,
then repeats rapidly. This is handled **entirely client-side** — the client sends repeated
`MoveLeft`/`MoveRight` messages. The server just processes each one independently. No server-
side timer or state needed.

---

## Implementation order

1. `game/input.rs` — `try_move_left`, `try_move_right`, `try_rotate_cw`, `try_rotate_ccw`
2. `InputResult` enum in `session.rs`, `GameSession::apply_input`
3. Hard drop in `apply_input` (reuse lock path from `tick_player`)
4. `RoomActor` wires `GameAction` → `apply_input` → sends response
5. Frontend sends `GameAction` on keydown, renders `PieceMoved` immediately
6. SRS wall kicks (follow-up, non-blocking)
7. Hold piece (follow-up)
