# TETR.IO Multiplayer Architecture Analysis

Reverse-engineered from the obfuscated `tetrio.js` client source. Line references are to that file.

---

## How it works at a high level

- Each player runs their **own board simulation locally** from keyboard inputs — no round-trip required
- The server receives batched input events, runs a **shadow simulation** for verification, and relays opponent inputs
- **No piece or board state is sent during normal play** — only key events
- Periodic full snapshots are embedded in the replay stream so the server can catch cheating or desync

---

## 1. Shared initialization

Server broadcasts one config to all players on `game.replay.enter`. Every client initializes from it identically.

The first two events pushed to the replay buffer are always `'start'` then `'full'` (lines 44560–44561):

```js
replay.pushEvent('start', {})
replay.pushEvent('full', siom.Snapshot())  // frame 0 board state
```

`siom.Snapshot()` captures (lines 42197–42211):

```js
{
  game: {
    board,        // full cell grid
    bag,          // upcoming piece queue
    hold: { piece, locked },
    g,            // current gravity
    controlling: { lShift, rShift, lastshift, inputSoftdrop },
    falling,      // active piece (type, x, y, rotation)
    handling,     // DAS/ARR settings
    playing,
  },
  stats,
  diyusi,
}
```

The server runs the same `StartGame()` path on its own shadow simulation (lines 44542–44551).

---

## 2. Deterministic RNG

A simple seeded PRNG — never `Math.random()` (line 31129):

```js
this._seed = (16807 * this._seed) % 2147483647
```

Server picks one seed, sends it in the game config. `seed_random` is forced `false` at line 35894, making the piece sequence fully reproducible across all peers from the same seed.

---

## 3. Input events — only keys, never state

Each event is just a logical key action and frame number (lines 38069–38072):

```js
{ frame: 42, type: 'keydown', data: { key: 'rotateCW', subframe: 0.3 } }
```

**Valid keys:** `moveLeft`, `moveRight`, `softDrop`, `hardDrop`, `rotateCW`, `rotateCCW`, `rotate180`, `hold`

Physical keycodes are mapped to these logical actions at capture time (lines 38066–38073). `subframe` is a 0.0–0.9 fractional position within the frame for sub-60fps timing precision.

---

## 4. Batching and flush

Every game frame, `provisioned` is incremented. When it reaches `provisionSpeed`, the buffer is flushed to the server (lines 35857–35917):

```js
// each frame
provisioned++
if (provisioned >= provisionSpeed) flush()

// flush
socket.send('game.replay', {
  gameid,
  provisioned: frame,  // how many frames you've simulated
  frames: eventsBuffer // all events since last flush
})
eventsBuffer = []
provisioned = 0
```

Provision speeds are latency-tiered (lines 35778–35783):

| Latency | Flush interval |
|---------|----------------|
| zero    | 15 frames      |
| low     | 15 frames      |
| medium  | 50 frames      |
| high    | 50 frames      |
| xhigh   | 50 frames      |

The speed is adjusted dynamically — faster after a `'full'` event, slower otherwise (line 35881).

---

## 5. Opponent simulation

Opponent inputs arrive from the server via `game.replay` (line 38024–38026), fed into a `'socket'`-type input source. You run the opponent's board locally using the same engine and the same starting seed — their inputs drive their simulation on your client.

Your board and the opponent's board are **independent simulations**. Your board never stalls waiting for the opponent's frames.

---

## 6. Periodic full snapshots (verification checkpoints)

Every 300 frames, a `'full'` event containing the complete board state is pushed into the replay stream (lines 41366–41368):

```js
const s = replay.frame - setoptions.fulloffset
if (s === 0 || s % setoptions.fullinterval === 0)
  replay.pushEvent('full', siom.Snapshot())
```

These snapshots travel inside the normal `game.replay` batch to the server. The server independently simulates your inputs and compares — a mismatch indicates either cheating or a desync.

---

## 7. Server roles

The server has exactly two jobs:

1. **Verification** — re-simulate each player's game from their batched inputs and compare against the `'full'` snapshots. The server runs `doAllFrames()` (lines 31383–31386) using the same engine in headless mode (`IsHeadless()`).

2. **Cross-player events** — garbage attacks, targeting, kills. Clients do not decide "I sent a tetris, opponent gets 4 lines" unilaterally. This is pushed down from the server as `game.replay.ige` (incremental game events).

A snapshot mismatch catches both cheating **and** legitimate desyncs — the server cannot distinguish them from the diff alone. That's why the resync path exists rather than an immediate ban.

---

## 8. Desync / resync flow

When `synced` drops false, the game loop freezes and a resync is requested (lines 40567–40586, 42284–42327):

```
client                        server
  |                              |
  | -- game.scope.start -------> |
  |                              |
  | <-- game.replay.state ------ |
  |   'early'  → just unlock     |
  |   'wait'   → retry in 1s     |
  |   {state}  → InjectState()   |
  |                              |
  | -- game.scope.end ---------> |
```

`InjectState()` overwrites everything — board, bag, falling piece, RNG seed, stats. After injection, `synced = true` and the game loop resumes (line 42313).

The game loop gate (line 41332–41334):
```js
if (!iom.IsSynced()) return   // frozen until resynced
```

`IsSynced()` requires both `_scoped` and `_synced` to be true for online sessions (line 40558–40559).

---

## What to build for a stripped-down version

### Irreducible core

1. Server picks a seed and sends it to all clients with the game config
2. Each client initializes simulation from `Snapshot()` at frame 0
3. Keyboard events are mapped to logical actions and stored with their frame number
4. Every N frames, flush `{ gameid, provisioned, frames: [...] }` to the server
5. Server relays opponent's frames back; each client simulates opponent board independently
6. Every 300 frames, embed a `'full'` snapshot in the flush for server verification

### What you can skip initially

- `subframe` precision — only matters at very high speed
- Adaptive `provisionSpeed` — use a fixed flush interval to start
- `IsFallingBehind` catch-up ticks — only needed if opponent buffer runs far ahead
- Full `game.scope` resync — disconnect/reconnect is fine for a prototype
