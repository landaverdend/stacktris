# Stacktris

Multiplayer battle Tetris with a Bitcoin Lightning betting layer (in progress)

**Stack:** Node.js (Express, WebSockets) · React · TypeScript · Canvas 2D

## Running locally

```bash
npm install
npm run dev
```

Starts backend and frontend concurrently. Backend at `http://localhost:8080`, frontend at `http://localhost:5173`. Open two browser tabs to play against yourself.

**Or separately:**

```bash
npm run dev:backend   # http://localhost:8080 (/ws)
npm run dev:frontend  # http://localhost:5173
```

## Docker

```bash
docker compose up --build
```

Builds the full monorepo and serves the app (frontend + backend) at `http://localhost:3000`.


## Fund Safety & Cheat Prevention

Stacktris is **server-authoritative**: the server runs a full, independent simulation of every player's game. Clients send only input actions — the server replays them to derive the true board state. A client cannot claim a false score, misplace a piece, or survive when it shouldn't, because the server never trusts client-reported game state.

Idle/tab-out exploits are also blocked: a watchdog force-ticks any stalled player's game forward under gravity, so pieces keep falling regardless of whether the client is sending inputs.

There is no automated anti-cheat or kick system. The server enforces game physics and state integrity, but does not police player skill or coordination (e.g. botted inputs or collusion)- such a feature is out of scope for a hackathon, however.

## Early quit & Lightning hold invoices

Bets are locked via **Lightning hold invoices**: funds are committed the moment a player joins a match but only settled when the session ends. Disconnecting early does not release your funds — the invoice is settled on disconnect, so quitting mid-game to chase a refund is not possible.

