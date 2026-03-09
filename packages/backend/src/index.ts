import express from 'express';
import { createServer } from 'http';
import { GameServer } from './GameServer.js';

const app = express();
const PORT = process.env.PORT ?? 8080;

app.use(express.json());

const server = createServer(app);
const gameServer = new GameServer(server);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/rooms', (_req, res) => {
  res.json(gameServer.openRooms());
});

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
