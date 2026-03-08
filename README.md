# Stacktris

Multiplayer battle Tetris with a Bitcoin Lightning betting layer (in progress). Two players share the same piece sequence and play head-to-head in real time. Clearing lines will eventually send garbage to the opponent.

**Stack:** Rust (Axum, Tokio) · WebSockets · React · TypeScript · Canvas 2D

## Running locally

```bash
./dev.sh
```

Builds and starts both services. Backend at `http://localhost:3000`, frontend at `http://localhost:5173`. Open two browser tabs to play against yourself.

**Or separately:**

```bash
cd backend && cargo run          # http://localhost:3000  (/ws)
cd frontend && npm install && npm run dev  # http://localhost:5173
```
