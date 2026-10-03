import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import apiRoutes from './routes/api';

import { createProxyMiddleware } from 'http-proxy-middleware';

// This will instantiate the service and auto-start cameras if configured
import { decoderService } from './services/v380-wrapper';
import { recorderService } from './services/recorder';

dotenv.config();

const app = express();
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 5050 : 4000);

app.use(cors());
app.use(express.json());

// Proxy for camera MJPEG stream and Snapshot bypassing Next.js path colon issues
// Matches /stream/:port/* and proxies to http://127.0.0.1::port/*
app.use('/stream/:port', (req, res, next) => {
  const targetPort = req.params.port;
  if (!targetPort || isNaN(Number(targetPort))) {
    return res.status(400).send('Invalid port');
  }

  createProxyMiddleware({
    target: `http://127.0.0.1:${targetPort}`,
    changeOrigin: true,
    ws: true, // proxy websockets as well if needed
    pathRewrite: {
      '^/stream/\\d+': '', // remove the /stream/:port part when forwarding
    },
    on: {
      error: (err: any, req: any, res: any) => {
        console.error(`[Proxy Error] Stream proxy to port ${targetPort} failed:`, err.message);
        if (!res.headersSent) res.status(502).send('Bad Gateway - Stream offline');
      }
    }
  })(req, res, next);
});

// Main API Routes
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'v380-nvr-backend' });
});

function getBackendDir(): string {
  let cur = __dirname;
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(cur, 'bin')) && (fs.existsSync(path.join(cur, 'package.json')) || fs.existsSync(path.join(cur, 'prisma')))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return path.join(__dirname, '..');
}

function getFrontendOutDir(): string | null {
  const candidates = [
    path.join(path.dirname(getBackendDir()), 'frontend', 'out'),
    path.join(__dirname, '..', '..', 'frontend', 'out'),
    path.join(__dirname, '..', 'frontend', 'out'),
    (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'frontend', 'out') : '',
  ].filter(Boolean);

  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

// Serve exported static frontend if available (Production / Desktop Mode)
const frontendOut = getFrontendOutDir();
if (frontendOut) {
  console.log(`[Backend] Serving static frontend from: ${frontendOut}`);
  app.use(express.static(frontendOut));

  app.use((req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }
    if (path.extname(req.path)) {
      return next();
    }
    const cleanPath = req.path.replace(/^\//, '');
    const exactHtml = path.join(frontendOut, `${cleanPath}.html`);
    if (cleanPath && fs.existsSync(exactHtml)) {
      return res.sendFile(exactHtml);
    }
    const subIndex = path.join(frontendOut, cleanPath, 'index.html');
    if (cleanPath && fs.existsSync(subIndex)) {
      return res.sendFile(subIndex);
    }
    const rootIndex = path.join(frontendOut, 'index.html');
    if (fs.existsSync(rootIndex)) {
      return res.sendFile(rootIndex);
    }
    next();
  });
}

const server = app.listen(PORT, () => {
  console.log(`[Backend] V380 NVR Backend running on http://localhost:${PORT}`);
});

const handleShutdown = (signal: string) => {
  console.log(`[Backend] Received ${signal}. Shutting down services cleanly...`);
  recorderService.stopAll();
  decoderService.stopAll();
  server.close(() => {
    console.log('[Backend] HTTP server closed.');
    process.exit(0);
  });
  // Force exit after 3 seconds if hanging
  setTimeout(() => process.exit(0), 3000);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
