# Anti-Cheat & Sync Design

## Problem

The server runs a headless game for each player by ticking the `GameEngine` reactively — only when input batches arrive. If a client tabs out, the browser suspends `requestAnimationFrame`, the frame counter freezes, and inputs stop arriving. The server's simulation for that player stalls too.

This creates two issues:
1. **Tab-out freeze exploit** — a player can pause their game (and garbage timers, which are frame-relative) while opponents continue playing.
2. **Desync on return** — when the client resumes, their local state has diverged from what the server would have simulated.

---

## Design

### Server-side wall clock

When a round starts, record:

```ts
this.roundStartTime = Date.now();
```

The expected frame at any point in time is:

```ts
const FRAME_DURATION_MS = 1000 / 60; // ~16.67ms
const expectedFrame = Math.floor((Date.now() - this.roundStartTime) / FRAME_DURATION_MS);
```

Send `expectedFrame` in the `game_start` message so clients initialize their local frame counter to the same origin.

---

### Two cases: normal latency vs. tab-out

#### Case 1 — Normal latency (always present, always acceptable)

Every input batch arrives at the server slightly in the past due to RTT. This is expected and the current reactive model handles it correctly. The client's reported `upToFrame` is trusted:

```
client sends: frame=1000, inputs=[{frame:992, move_left}, {frame:997, hard_drop}]

server ticks player: 980 → 992, applies move_left
server ticks player: 992 → 997, applies hard_drop
server ticks player: 997 → 1000  ← upToFrame
```

No special handling needed. The shared deterministic engine + seed keeps both sides in sync.

#### Case 2 — Tab-out / extreme lag

The wall clock advances but the client's reported frame stops. Once a player falls more than `MAX_LAG_FRAMES` behind the expected frame, the server stops waiting and begins force-ticking their game with zero inputs:

```ts
const MAX_LAG_FRAMES = 120; // 2 seconds

// In the server's tick interval (~100ms):
const expected = Math.floor((Date.now() - this.roundStartTime) / FRAME_DURATION_MS);
for (const [id, pg] of this.playerGames) {
  if (expected - pg.frameCount > MAX_LAG_FRAMES) {
    pg.tickTo(expected); // advances under gravity with no inputs
  }
}
```

Gravity still applies during these ticks. Pieces fall and lock. This is the natural game penalty for tabbing out — no special punishment needed.

---

### Handling stale inputs on return

When the client returns and sends a `game_action`, compare its reported frame against the server's current frame for that player:

```ts
const serverFrame = Math.floor((Date.now() - this.roundStartTime) / FRAME_DURATION_MS);
if (serverFrame - message.frame > MAX_LAG_FRAMES) {
  // inputs are stale — server has already ticked past this point
  // discard the inputs and send an authoritative snapshot
  this.send(playerId, { type: 'game_snapshot', snapshot: pg.getSnapshot() });
  return;
}
// otherwise process normally
```

The client snaps its board state to the server's ground truth on receipt of the snapshot.

---

### Key invariant

The server only force-ticks a player **after they've fallen past the lag window**. Until then, the client's `upToFrame` is trusted and the reactive model is sufficient. The wall clock is a threshold detector, not a frame-by-frame override.

```
within window  → client's frame is trusted, reactive tick, no intervention
outside window → server force-ticks with zero inputs, stale inputs discarded, snapshot sent on reconnect
```

---

### Why retroactive compensation isn't needed

In a shooter, lag compensation matters because two players interact in the same spatial moment (did the bullet connect?). In Tetris, each player's board is fully independent — the only cross-player interaction is garbage, which already has a 600-frame (~10 second) delay buffer. A 50ms input lag on board state has no gameplay impact as long as the simulation is deterministic.

No rewinding. No replaying. Just a window check.

---

## What this prevents

| Exploit | Mitigation |
|---|---|
| Tab-out time freeze | Server force-ticks their game under gravity |
| Lying about board state | Server's independent simulation is ground truth |
| Sending inputs from a stale frame | Inputs outside `MAX_LAG_FRAMES` window are discarded |
| Sending inputs out of order | `PlayerGame.handleInput` already sorts by frame |

---

## Changes Required

| File | Change |
|---|---|
| `round.ts` | Store `roundStartTime`, add tick interval that force-ticks stalled players |
| `playerGame.ts` | Add `tickTo(frame: number)` — advances with zero inputs to target frame |
| `protocol.ts` | Add `expectedFrame: number` to `game_start` message |
| `round.ts` | Validate incoming `game_action` frame against wall clock before processing |
| `frontend/NetworkGame.ts` | Initialize local frame counter from `expectedFrame` in `game_start` |
