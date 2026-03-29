# Stacktris

Multiplayer battle Tetris where players bet real sats. Winner takes the pot. No custodian — funds are locked in Lightning hold invoices and released directly to the winner's Lightning address when the match ends.

**Stack:** Node.js · Express · WebSockets · React · TypeScript · Canvas 2D · Lightning (NWC + BOLT11 hold invoices)

---

## How the betting works

1. Player sets a buy-in (sats) when creating a room
2. Each player who joins pays a **hold invoice** — funds are committed but not yet settled
3. The server holds all invoices open until the match concludes (first to 3 round wins)
4. **Loser invoices are settled** (funds collected into pot); **winner invoice is cancelled** (their funds released)
5. Server pays out the full pot to the winner's Lightning address via LNURL-pay

Once the match ends, the server briefly custodies the full pot (all settled invoices) and pays it out to the winner's Lightning address via LNURL-pay. The winner's own hold invoice is cancelled so they don't pay into the pot they just won. Disconnecting mid-match settles your invoice; there is no quit-for-refund path.

---

## Architecture

npm workspace monorepo with three packages:

```
packages/
  shared/    # Deterministic GameEngine, protocol types, binary codec
  backend/   # Express + WebSocket server, game session state machine, Lightning payments
  frontend/  # React + Canvas 2D, keyboard/gamepad input, opponent board rendering
```

**Key design decisions:**

- **Server-authoritative simulation** — the server runs an independent `GameEngine` per player. Clients send only input actions; the server derives board state. Clients cannot falsify scores or survival.
- **Deterministic shared engine** — `packages/shared/src/game/gameEngine.ts` runs identically on both sides from the same seed, keeping boards in sync without sending full state every frame.
- **Binary codec** — all WebSocket messages use a compact binary encoding (`packages/shared/src/codec/`) to reduce frame overhead.
- **Hold invoices for escrow** — prevents early-quit fund recovery without requiring a third-party escrow service.

See `docs/anticheat-sync.md` for the full anti-cheat and desync recovery design (tab-out freeze prevention, stale input handling, force-tick under gravity).

---

## Session flow

```
waiting → countdown (3s) → playing → intermission (5s) → countdown → ...
                                         ↓ (first to 3 round wins)
                                      finished → payout
```

Up to 8 players per room. Each round: last alive wins. Garbage lines are sent to the next player in rotation with a 600-frame (~10s) delay. Room codes are 5-char alphanumeric (no ambiguous chars like I/O/1).

---

## Running locally

```bash
npm install
npm run dev
```

Backend: `http://localhost:8080` · Frontend: `http://localhost:5173`
Open two tabs to play against yourself.

```bash
# Separately:
npm run dev:backend
npm run dev:frontend
```

**Docker:**

```bash
docker compose up --build
# Serves everything at http://localhost:3000
```

**Required env var** (backend):

```
NWC_STRING=nostr+walletconnect://...   # Nostr Wallet Connect URI for your Lightning node
```

Without `NWC_STRING`, the server starts but the betting layer is disabled (rooms can be created with 0 sat buy-in).

---

## Tests

```bash
npm test   # runs shared + backend test suites via Vitest
```

---

## Future work

Out of scope for the hackathon but natural next steps:

- **Sound engine** — hook points exist throughout the game loop (piece lock, line clear, garbage incoming, danger signal) but no audio is wired up yet
- **Nostr integration** — publish match results as Nostr events; use NIP-07 for identity instead of a freeform player name; social layer for challenges and leaderboards
- **Disconnect/rejoin logic** — currently a disconnect mid-match is treated as a forfeit; a proper rejoin flow would let players reconnect within a grace window and receive an authoritative snapshot to resync from
- **Global leaderboard** — persistent win/loss records tied to a Lightning address or Nostr pubkey
- **Mobile layout** — on-screen touch controls and a responsive board layout for phone play

---

## License

MIT
