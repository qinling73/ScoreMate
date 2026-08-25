import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { roomRouter } from './server/routes/room.js';
import { setupSocketIO } from './server/socket.js';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Global Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'multiplayer-score-tracker',
      time: new Date().toISOString(),
    });
  });

  // WeChat Mini-Program compatibility spec endpoint
  app.get('/api/wechat/info', (req, res) => {
    res.json({
      supportedProtocols: ['REST', 'WebSocket'],
      version: '1.0.0',
      authMethod: 'Bearer Token / Body Token',
      wsEndpoint: '/socket.io/',
      description: 'Standard RESTful and Socket.io endpoints compatible with WeChat Mini Program (Taro/Uni-App/Native wx.request & wx.connectSocket)',
    });
  });

  app.use('/api/room', roomRouter);

  // Initialize Socket.io
  setupSocketIO(server);

  // Vite middleware for development / static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Multi-player score tracker running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
});
