# WebSocket Protocol

All messages are JSON with a `type` discriminant field. The connection is a single
persistent WebSocket per player at `/ws`. There is no REST API for game actions — all
game-related communication is over this socket.

---

## Client → Server

### `create_room`
Player wants to create a new room and become the first player.
```json
{ "type": "create_room", "bet_sats": 1000 }
```

### `join_room`
Player wants to join an existing room as the second player.
```json
{ "type": "join_room", "room_id": "abc-123", "bet_sats": 1000 }
```
The `bet_sats` must match the room's configured amount or the server rejects it.

### `game_action`
An input during active gameplay. Clients should send these as fast as the player presses
keys — the server buffers them and applies them in order on the next tick.
```json
{ "type": "game_action", "action": { "type": "move_left" } }
{ "type": "game_action", "action": { "type": "move_right" } }
{ "type": "game_action", "action": { "type": "rotate_cw" } }
{ "type": "game_action", "action": { "type": "rotate_ccw" } }
{ "type": "game_action", "action": { "type": "soft_drop" } }   // held = continuous
{ "type": "game_action", "action": { "type": "hard_drop" } }
{ "type": "game_action", "action": { "type": "hold" } }
```

---

## Server → Client

### `room_created`
Sent immediately after `create_room`. Contains the room ID to share with the opponent
and (later) a Lightning invoice the creator must pay before the game starts.
```json
{
  "type": "room_created",
  "room_id": "abc-123",
  "invoice": "lnbc1000n1..."   // stub until Lightning is wired
}
```

### `room_joined`
Sent to the joining player on success.
```json
{
  "type": "room_joined",
  "room_id": "abc-123",
  "invoice": "lnbc1000n1..."
}
```

### `player_joined`
Sent to the *existing* player when the second player joins.
```json
{ "type": "player_joined", "room_id": "abc-123" }
```

### `game_start`
Sent to both players when the room transitions to Countdown. `countdown` is seconds.
```json
{ "type": "game_start", "countdown": 3 }
```

### `game_state`
The main update message. Sent after every meaningful state change (piece lock, line
clear, garbage, or at minimum every 100ms during active play). Clients should render
this as their source of truth.
```json
{
  "type": "game_state",
  "room_id": "abc-123",
  "phase": "playing",
  "your": {
    "board": [["I", null, null, ...], ...],
    "current_piece": { "kind": "T", "col": 4, "row": 18, "rotation": 0 },
    "next_pieces": ["S", "I", "O"],
    "hold_piece": null,
    "pending_garbage": 2,
    "score": 1500,
    "lines": 6,
    "level": 0
  },
  "opponent": {
    "board": [["L", null, null, ...], ...],
    "pending_garbage": 0,
    "score": 800,
    "lines": 3,
    "level": 0
  }
}
```

### `game_over`
Sent to both players when the game ends.
```json
{
  "type": "game_over",
  "winner_id": "player-uuid-here",
  "your_score": 4200,
  "opponent_score": 2100
}
```

### `error`
Sent when the server can't process a request.
```json
{ "type": "error", "message": "Room not found" }
```

---

## Message Flow for a Full Game

```
Player A                    Server                    Player B
────────                    ──────                    ────────
create_room ──────────────►
                            ◄──── room_created (A)

                            [A shares room_id out-of-band with B]

                            ◄──── join_room ──────────────── B
                ──── room_joined ────────────────────────────►
                ──── player_joined ──►
                [both pay invoices — future]
                ──── game_start ─────────────────────────────►
◄── game_start ─────────────────────────────────────────────

[3 second countdown]

game_action (move_left) ──►
                            ──── game_state ─────────────────►
◄── game_state ─────────────────────────────────────────────

[... gameplay loop ...]

[Player B tops out]
◄── game_over (winner: A) ──────────────────────────────────
                            ──── game_over (winner: A) ──────►
```

---

## Design Notes

**Why not send delta updates?**
Full snapshots are simpler to implement, easier to debug, and correct by construction —
no risk of clients getting out of sync. At 60fps with a 10×24 board, a full snapshot is
~2.5KB uncompressed. In practice we broadcast much less often (every piece lock or line
clear). This is fine for a v1.

**Input buffering**
The server buffers all `game_action` messages received between ticks and applies them in
order on the next 60Hz tick. This means rapid-fire key presses (DAS — Delayed Auto Shift)
are faithfully reproduced server-side. The client should implement its own DAS timing and
send repeat `move_left`/`move_right` messages accordingly.

**No heartbeat / ping-pong**
Axum's WebSocket layer handles this automatically via the RFC 6455 ping/pong mechanism.
No application-level heartbeat needed.
