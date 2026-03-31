# Anti-Cheat & Sync Design

## Architecture overview

The server runs an independent headless `GameEngine` simulation for each player — the same deterministic engine the client runs, seeded identically. The client is trusted for inputs and frame timing within a lag window; the server is authoritative for everything else.

```
client                              server
──────────────────────────────────────────────────────
GameEngine (local, responsive)      GameEngine (headless, authoritative)
  ↑ inputs land instantly             ↑ inputs arrive ~RTT later
  ↓ renders every frame               ↓ only ticks when inputs arrive
                                        or watchdog fires
```

Cross-player interactions — garbage routing, attack accounting, game-over detection — happen exclusively on the server. The client never talks to another player's sim directly.

---

## Input handling

The client batches inputs every 10 frames and sends them as `game_action`:

```
{ type: 'game_action', buffer: [{frame, action}, ...], frame: upToFrame }
```

The server replays them in frame order, then ticks the sim forward to `upToFrame`:

```
client sends: upToFrame=1000, inputs=[{frame:992, move_left}, {frame:997, hard_drop}]

server: tick 980→992, apply move_left
        tick 992→997, apply hard_drop
        tick 997→1000
```

Inputs are sorted by frame on arrival (`handleInput` in `PlayerGame`), so out-of-order delivery is harmless.

---

## Heartbeat & correction

Every 300 frames (~5 seconds) the client sends a `game_state_heartbeat` containing its current board, active piece, hold, bag position, and pending garbage queue. The server diffs this against its own sim:

**Correction fields** (trigger a `game_state_update` snapshot if they differ):
- `board` — cell-by-cell comparison
- `isGameOver`
- `holdPiece` / `holdUsed`
- `bagPosition`

**Info-only fields** (logged but not corrected):
- `gravityLevel` — float32 precision loss in the codec causes false positives
- `activePiece` — mid-flight, expected to drift slightly
- `pendingGarbage` — garbage queue is kept in sync via `garbage_queue_sync` (see below), so heartbeat drift here is diagnostic only

When a correction is sent, the client calls `engine.updateState()` which replaces the relevant fields and re-syncs.

---

## Tab-out / stall prevention

The server records `roundStartTime = Date.now()` at round start. A watchdog fires every 100ms:

```ts
const serverFrame = Math.floor((Date.now() - roundStartTime) / FRAME_DURATION_MS);
if (serverFrame - pg.frameCount > MAX_LAG_FRAMES) { // 120 frames = 2 seconds
  pg.tickTo(serverFrame); // advance with zero inputs — gravity and lock delay still fire
}
```

This prevents the tab-out freeze exploit: a player who pauses their browser still has their pieces fall and lock on the server. When they return, their client receives a correction at the next heartbeat.

Stale inputs (arriving more than `MAX_LAG_FRAMES` behind the current server frame) are detected on `game_action` receipt and answered with an immediate `game_state_update` snapshot, discarding the stale buffer.

---

## Garbage system (server-authoritative)

### Routing

When a player clears lines, their server-side engine emits an `attack` event with the line count. `Round` routes this to a target player's `PlayerGame.addGarbage()`, which queues it with a `triggerFrame = sentFrame + GARBAGE_DELAY_FRAMES` (240 frames, ~4 seconds).

Targeting cycles PPT-style through alive players in a stable order, advancing one slot per attack.

### Why the server owns the queue

Garbage queue mutations happen on the server sim in two situations:

1. **Add** — `addGarbage` is called when an opponent attacks.
2. **Cancel** — `clearPendingGarbage` is called when the receiving player's server sim processes a line clear.

Both mutations are invisible to the receiving client unless the server explicitly notifies it. Before the current design, only adds were communicated (`game_garbage_incoming`). Cancellations were silent. This caused the client to hold ghost garbage entries that the server had already removed, leading to board divergence when the ghost entry fired at `triggerFrame`.

**Incident evidence** (from `debug_logs/Logs-logs-2026-03-30 21_14_53.txt`):
```
frame 1500: client pendingGarbage=[{lines:4, triggerFrame:1631, gap:7}]
            server pendingGarbage=[]

frame 1800: board (96 cells differ) — ghost garbage applied at triggerFrame 1631
            bagPosition: client=30, server=31  ← downstream cascade
            holdPiece: client=L, server=S
```

The client applied 4 garbage lines the server had already cancelled. The board shifted up, consuming one extra piece from the bag, offsetting every future draw by 1.

### The fix: `garbage_queue_sync`

The server subscribes to the `pendingGarbage` engine event on each player's `GameEngine`. This event fires on every `setPendingGarbage` call — both adds and cancellations:

```ts
pg.subscribe('pendingGarbage', (queue) => {
  players[playerId].sendFn({ type: 'garbage_queue_sync', queue });
});
```

The client replaces its queue wholesale on receipt:

```ts
ws.on('garbage_queue_sync', (msg) => {
  gameEngine.syncGarbageQueue(msg.queue);
});
```

`syncGarbageQueue` calls `setPendingGarbage` internally, which fires the client-side `pendingGarbage` event so UI subscribers (e.g. `GarbageMeter`) stay current.

There is no partial update, no per-entry ack, no sequence number. The server's queue is the truth; the client replaces its queue every time it hears otherwise.

### Optimistic local cancel

The client still runs `clearPendingGarbage` locally when it clears lines, so the garbage meter reacts immediately without waiting for a server round-trip. The next `garbage_queue_sync` from the server will correct any discrepancy — if the server cancelled more or less than the client did, the client queue snaps to match.

---

## What the server is authoritative for

| Domain | Authority | Mechanism |
|---|---|---|
| Board state | Server | Heartbeat diff → `game_state_update` correction |
| Bag / piece sequence | Server | Shared seed + heartbeat `bagPosition` check |
| Garbage routing | Server | `Round.routeGarbage` — client never routes |
| Garbage queue contents | Server | `garbage_queue_sync` on every queue mutation |
| Game-over detection | Server | `Round.killPlayer` → `gameOver` event |
| Targeting order | Server | PPT-style round-robin, server-managed |
| Tab-out ticking | Server | Watchdog force-ticks stalled players |

---

## What clients are trusted for

- **Input timing** — frame numbers on input events, within the lag window
- **Optimistic local cancel** — cleared garbage is removed immediately client-side; server corrects if needed
- **Rendering** — all visual state is derived from the local engine; corrections snap the engine, not the renderer directly

---

## What this prevents

| Exploit | Mitigation |
|---|---|
| Tab-out time freeze | Watchdog ticks their sim under gravity after `MAX_LAG_FRAMES` |
| Lying about board state | Server's independent sim is ground truth; corrected at heartbeat |
| Lying about bag position | Heartbeat `bagPosition` check; shared seed makes forgery detectable |
| Ghost garbage exploit | `garbage_queue_sync` on cancels — client cannot hold garbage the server removed |
| Infinite garbage stalling | Garbage triggers by server frame, not client frame |
| Sending inputs from a stale frame | Inputs outside lag window are discarded; snapshot sent instead |
| Sending inputs out of order | `PlayerGame.handleInput` sorts by frame before replay |
