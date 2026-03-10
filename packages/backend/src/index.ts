import express from 'express';
import { createServer } from 'http';
import { WSServer } from './WSServer.js';
import { RoomManager } from './RoomManager.js';

const app = express();
const PORT = process.env.PORT ?? 8080;

app.use(express.json());


const roomManager = new RoomManager();

const server = createServer(app);
const wss = new WSServer(server, roomManager);





app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/rooms', (_req, res) => {
});

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
