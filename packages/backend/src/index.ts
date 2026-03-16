import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WSServer } from './wsServer.js';
import { RoomRegistry } from './roomRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT ?? 8080;
const STATIC_DIR = process.env.STATIC_DIR ?? path.join(__dirname, '../../frontend/dist');

app.use(express.json());
app.use(express.static(STATIC_DIR));

const roomRegistry = new RoomRegistry();

const server = createServer(app);
const wss = new WSServer(server, roomRegistry);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/rooms', (_req, res) => {
  const rooms = roomRegistry.listRooms();
  res.json(rooms);
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
