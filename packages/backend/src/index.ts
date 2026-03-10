import express from 'express';
import { createServer } from 'http';
import { WSServer } from './wsServer.js';
import { RoomRegistry } from './roomRegistry.js';

const app = express();
const PORT = process.env.PORT ?? 8080;

app.use(express.json());


const roomRegistry = new RoomRegistry();

const server = createServer(app);
const wss = new WSServer(server, roomRegistry);


app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/rooms', (_req, res) => {
});

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
