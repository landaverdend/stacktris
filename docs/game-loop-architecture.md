# Game Loop Architecture: Client Prediction & Server Reconciliation

Reference: https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html

---

## Core Problem

The server is authoritative, but sending every input to the server and waiting for a response before rendering creates unacceptable lag. At 100ms latency a player would see their piece move half a second after pressing a key.

The solution: **predict locally, reconcile when the server responds**.

---

## What We Predict vs. What We Don't

The article warns "don't predict health" because another player can modify your state mid-play (the first aid kit scenario). In Tetris this is mostly not the case — **your board is private while a piece is active**. Garbage is buffered and only inserted at piece spawn, not mid-piece. So for the entire lifetime of a single active piece, the board below it is frozen from your perspective.

### Predicted on the client (safe to simulate locally)
- Active piece position (row, col, rotation) after player inputs
- Active piece position after gravity ticks (Option C, see below)
- Piece lock — the client knows the piece has landed; lock is deterministic
- Line clears — fully deterministic given board + lock position
- Board state post-clear — follows directly from the above
- Score update — deterministic from lines cleared and current level

### Never predicted — server is the only source of truth
- **Next piece** — predictable once seed is known (see below)
- **Garbage insertion** — depends on the opponent's actions; applied at spawn time
- **Board state after spawn** — may include garbage the client doesn't know about yet
- Game over

### Why this is safe

The only window where a prediction could be wrong is if garbage arrives *and* the piece locks in the same round trip. Since garbage is inserted at spawn (not mid-piece), the client's lock prediction is always against the correct board. The reconciliation happens at the next spawn when the server sends the new piece + updated board, which may include garbage that the client didn't predict. Snap to server board, start the next piece. Clean.

---

## Shared Piece Queue (Seeded Bag)

At match start the server sends a single `seed` in `game_start`. Both clients initialize their bag randomizer with that seed and independently generate the same piece sequence for the entire game.

```ts
{ type: 'game_start', countdown: number, seed: number }
```

The seeded bag implementation lives in `@stacktris/shared` so the server and both clients use the exact same code. As long as every client advances the bag on the same events (piece spawn, hold with empty slot), they stay in sync automatically.

This is a deliberate competitive design choice: both players face identical piece sequences, so the skill gap is entirely execution — not RNG luck.

### Queue checksum (optional drift detection)

The server can periodically send a checksum of its current bag position alongside `piece_spawned`. If the client's local checksum doesn't match, it resets its bag to the server's state. This catches any divergence caused by bugs or edge cases without requiring the server to stream piece data.

---

## The Input Buffer Pattern

Each player input is tagged with a monotonically increasing sequence number before being sent to the server:

```
{ seq: 42, action: 'move_right' }
```

The client:
1. Applies the input immediately to its local piece state (prediction)
2. Appends `{ seq, action }` to a **pending input buffer**
3. Sends the input to the server

The server:
1. Validates the input against authoritative board state
2. Applies it if legal, ignores it if not
3. Replies with `{ last_seq: 42, piece: { kind, row, col, rotation } }`

When the client receives a server response:
1. Discard all entries in the pending buffer where `seq <= last_seq`
2. Set local piece state = server's piece state
3. Re-apply all remaining pending inputs in order
4. Render the result

Most of the time step 3 produces the same state that was already on screen — no visible correction.

---

## When the Server Rejects an Input

There is no explicit "reject" message needed. The server simply does not apply the illegal move and responds with `last_seq` set to the input's sequence number anyway, along with the correct piece position.

The client receives this, resets to the server's piece, and replays its remaining pending inputs from there. The piece snaps to the correct position — typically a single cell correction, not a jarring jump.

---

## Gravity

Gravity is time-driven, not input-driven, which requires a decision:

### Option A — Client sends gravity as an input
Gravity fires on the client's tick timer. The client sends `{ seq, action: 'gravity' }` (or treats it as `soft_drop`) with a sequence number like any other input. The server validates timing and applies it. This is the most correct fit for the article's model.

### Option B — Server owns gravity entirely
The server runs its own gravity loop and pushes `piece_moved` to the client when a tick fires. The client applies the update. Simple and cheat-resistant, but adds latency to every gravity tick.

### Option C — Both run gravity independently, server is authoritative
The client runs its own gravity timer. The server runs its own gravity timer. When they align (almost always), nothing corrects. When they differ (lag spike, timer drift), the next server response snaps the piece. No extra messages needed.

**Recommended starting point: Option C.** It's the pragmatic choice for this game — gravity ticks are slow enough (500ms at level 1) that drift is rare and corrections are small. If anti-cheat becomes a concern at high level play, migrate to Option A.

---

## Piece Lock

**Predict the lock.** When the client detects the piece has landed (no valid move down), it predicts the lock: commits the piece to the local board, runs line clear logic, updates local score. All of this is deterministic and does not require server permission.

What the client does NOT do: render the next piece until the server sends it. Show a brief "waiting for next piece" state (in practice this is imperceptible at normal latency) while the server confirms the lock, processes any garbage, and sends `piece_spawned` with the new piece and authoritative board state.

At that point, if the server's board differs from the client's predicted board (e.g. garbage was added), snap to the server board. This is the only reconciliation point that matters for board state, and it happens cleanly at spawn boundaries.

---

## The Full Flow During Play

```
Player Input
    │
    ▼
Apply locally (prediction)          ──► Render updated piece
Add to pending buffer
Send { seq, action } to server
    │
    ▼
Server receives input
Validate against authoritative board
Apply if legal
Reply { last_seq, piece }
    │
    ▼
Client receives server response
    1. Discard pending buffer entries ≤ last_seq
    2. Reset local piece = server piece
    3. Re-apply remaining pending inputs
    4. Render (usually unchanged)
```

---

## Data Structures Needed on the Client

```ts
interface PendingInput {
  seq: number;
  action: InputAction;
}

// Lives in useGameState
let pendingInputs: PendingInput[] = [];
let nextSeq = 0;

// Current local piece (predicted)
let localPiece: PieceSnapshot | null = null;

// Board — only updated from server
let board: number[][];
```

---

## What Needs to Change in the Protocol

The current `game_action` message:
```ts
{ type: 'game_action', action: InputAction }
```

Needs to become:
```ts
{ type: 'game_action', seq: number, action: InputAction }
```

The current `piece_moved` server response:
```ts
{ type: 'piece_moved', your_piece: PieceSnapshot | null }
```

Needs to include `last_seq`:
```ts
{ type: 'piece_moved', last_seq: number, your_piece: PieceSnapshot | null }
```

`score_update`, `hold_update`, and `game_state` do not need sequence numbers — they are not reconciliation responses, they are authoritative pushes.

---

## Summary

| Concern | Client predicts? | Notes |
|---|---|---|
| Active piece position | Yes | Reconciled on every `piece_moved` |
| Gravity ticks | Yes (Option C) | Both run timers; server wins on diff |
| Piece lock | Yes | Board is frozen mid-piece; safe to predict |
| Line clears | Yes | Deterministic from board + lock position |
| Board state post-clear | Yes | Follows from lock + clear prediction |
| Score / level | Yes | Deterministic from lines + level |
| Next piece / queue | Yes | Derived from shared seed locally |
| Hold piece swap | Yes | Client advances bag per swap rules |
| Garbage insertion | **No** | Depends on opponent; applied at spawn |
| Board state post-spawn | **No** | May include garbage; snap to server |

Predictions are safe through the entire life of a piece. The single reconciliation point is **piece spawn** — when the server sends the next piece and authoritative board, the client snaps to that state. Everything in between is local.
