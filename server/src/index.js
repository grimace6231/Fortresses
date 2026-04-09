import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { LobbyManager } from './lobby/LobbyManager.js';
import { registerHandlers } from './socket/handlers.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL,
].filter(Boolean);

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

const lobby = new LobbyManager();

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  registerHandlers(io, socket, lobby);
});

// Clean up finished/abandoned games every 5 minutes
setInterval(() => lobby.cleanup(), 5 * 60 * 1000);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
