import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';

import { createProxyMiddleware } from 'http-proxy-middleware';

// This will instantiate the service and auto-start cameras if configured
import './services/v380-wrapper';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

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

app.listen(PORT, () => {
  console.log(`[Backend] V380 NVR Backend running on http://localhost:${PORT}`);
});
