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
