# Stacktris — Architecture Overview

## Big Picture

```
Browser (React/TS)          Rust Backend (Axum)
─────────────────          ───────────────────
                           ┌──────────────────┐
  WS connection ◄─────────►  session layer    │
  send inputs              │  (per-connection  │
  render server state      │   task)           │
                           │        │          │
                           │        ▼          │
                           │  ┌──────────────┐ │
                           │  │  room actor  │ │  ← tokio task per room
                           │  │  (game loop) │ │
                           │  └──────────────┘ │
                           └──────────────────┘
```

The server is **authoritative**. Clients send raw inputs (move, rotate, drop). The server
runs the game, determines piece locks, line clears, garbage, and game-over. Clients
render what the server tells them. This matters because real money changes hands.

---

## Why Server-Authoritative?

Since players are betting sats, the server must own the game outcome — we can't trust the
client to report its own board. This means:

- Board state lives on the server
- Line clears are computed server-side
- Garbage is applied server-side
- Game-over is declared server-side
- Lightning payout is triggered by the server

The tradeoff is latency feel. Mitigation: the client can do **local display prediction**
for the currently falling piece (showing it move immediately on keypress) while the
authoritative position lives on the server. On the next state broadcast the client snaps
to the real position. Piece locks are never predicted client-side — only movement within
the current cell.

---

## Backend Module Map

```
backend/src/
├── main.rs             server setup, router, shared AppState
├── protocol.rs         all WS message types (ClientMsg / ServerMsg)
├── session/
│   ├── mod.rs          PlayerSession — owns ws sender + mpsc receiver
│   └── registry.rs     SessionRegistry — player_id → mpsc::Sender<ServerMsg>
├── room/
│   ├── mod.rs          RoomHandle — public API wrapping the actor channel
│   ├── actor.rs        RoomActor — owns all mutable room state, runs game loop
│   ├── lifecycle.rs    room phase state machine (Waiting → Ready → Countdown → Playing → Done)
│   └── registry.rs     RoomRegistry — room_id → RoomHandle
└── game/
    ├── mod.rs
    ├── board.rs        Board (20×10), collision, locking, line-clear
    ├── piece.rs        TetrominoType, Piece, SRS rotation tables
    ├── queue.rs        PieceQueue — shared seeded 7-bag randomizer
    ├── gravity.rs      gravity intervals, soft-drop, lock delay
    └── garbage.rs      garbage line generation + pending garbage queue
```

## Frontend Module Map

```
frontend/src/
├── types/index.ts        all shared types (mirrors server protocol)
├── constants/tetris.ts   board dims, colors, level speeds
├── game/tetris.ts        pure game logic (used for solo mode only)
├── hooks/
│   ├── useTetris.ts      solo game loop (local, no server)
│   ├── useWebSocket.ts   raw WS connection
│   └── useGameRoom.ts    room state machine driven by server messages
└── components/
    ├── TetrisBoard.tsx   SVG renderer (board + piece + ghost)
    ├── NextPiece.tsx     piece preview
    ├── BattleArena.tsx   two-board battle view (local + opponent)
    ├── GameLobby.tsx     create/join/solo UI
    └── LightningInvoice.tsx  BOLT-11 payment UI
```

---

## Connection Architecture

Each WebSocket connection lives in its own tokio task. When a player joins a room, the
room actor is given a `mpsc::Sender<ServerMsg>` it can use to push updates to that player.
The connection task runs `tokio::select!` over two branches simultaneously:

```
connection task
├── branch A: recv from WebSocket → decode ClientMsg → forward to room actor channel
└── branch B: recv from mpsc::Receiver<ServerMsg> → encode → send to WebSocket
```

This avoids any shared mutable state between the connection task and the room actor.
The room actor never touches the WebSocket directly.

```
WebSocket task          Room Actor
─────────────           ──────────
ws.recv()  ──► RoomCmd::Input ──►  room_rx
                                        │
               mpsc::Sender ◄── broadcast to player senders
player_tx ◄───────────────────────────────
ws.send() ◄── player_rx
```

---

## Room Actor & Game Loop

The room actor is a long-lived tokio task per room. It owns all mutable room state and
runs via `tokio::select!` over:

1. `room_rx` — commands from connection tasks (input, join, leave)
2. `tick_interval` — 60Hz timer for input processing
3. `gravity_interval` — level-dependent timer for automatic piece drop

```rust
loop {
    tokio::select! {
        Some(cmd) = room_rx.recv() => handle_command(cmd),
        _ = tick.tick() => process_inputs_and_update(),
        _ = gravity.tick() => apply_gravity(),
    }
}
```

After any state change that matters (piece move, lock, line clear, garbage, game over)
the actor broadcasts a `ServerMsg::GameState` snapshot to both players.

---

## Data Model

See `game-engine.md` for deep detail on each type. High-level:

```rust
// room/actor.rs
struct RoomActor {
    id: RoomId,
    phase: RoomPhase,
    bet_amount_sats: u64,
    piece_queue: PieceQueue,       // shared — one instance, both players index into it
    players: [PlayerSlot; 2],
}

struct PlayerSlot {
    player_id: PlayerId,
    sender: mpsc::Sender<ServerMsg>,  // to push state to this player's WS task
    game: PlayerGameState,
    input_queue: VecDeque<GameAction>, // buffered inputs since last tick
    payment: PaymentState,             // for lightning (future)
}

struct PlayerGameState {
    board: Board,
    queue_index: usize,              // where this player is in the shared PieceQueue
    current_piece: Piece,
    hold_piece: Option<TetrominoType>,
    hold_used: bool,                 // can only hold once per piece
    pending_garbage: u32,            // queued garbage lines to receive on next lock
    score: u64,
    lines: u32,
    level: u32,
    back_to_back: bool,              // for B2B tetris bonus
    is_game_over: bool,
}
```

---

## Room Lifecycle

```
Waiting ──► Ready ──► Countdown ──► Playing ──► GameOver ──► Done
  │           │
  │           └─ (future) both players must pay invoice before Ready
  │
  └─ first player creates room, waits for second
```

Phase transitions are owned by the room actor. The actor fires `ServerMsg::GameStart`
when transitioning to Countdown, which starts a 3-second timer before gameplay begins.

---

## What's Not Here Yet (Future)

- **Lightning**: payment verification before `Ready`, payout on `GameOver`
- **Hold piece**: data model is stubbed (`hold_piece` field), logic not implemented
- **Spectators**: rooms currently support exactly 2 players
- **Reconnection**: if a player disconnects mid-game the room should pause briefly
- **Ranking / history**: no persistence yet, games are fully in-memory
