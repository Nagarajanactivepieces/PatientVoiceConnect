import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
// import { config } from '@config/environment';
import { setupRoutes } from './routes';
import { handleWebSocketConnection } from './websocket';
import { config } from '../config/environment';

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
setupRoutes(app);

// WebSocket server for Twilio Media Streams
const wss = new WebSocketServer({ server, path: '/media-stream' });
wss.on('connection', handleWebSocketConnection);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
server.listen(config.server.port, () => {
  console.log(`🚀 Server running on port ${config.server.port}`);
  console.log(`📞 Twilio webhook endpoint: http://localhost:${config.server.port}/incoming-call`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${config.server.port}/media-stream`);
});