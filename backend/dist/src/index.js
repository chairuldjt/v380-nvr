"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const api_1 = __importDefault(require("./routes/api"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
// This will instantiate the service and auto-start cameras if configured
require("./services/v380-wrapper");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Proxy for camera MJPEG stream and Snapshot bypassing Next.js path colon issues
// Matches /stream/:port/* and proxies to http://127.0.0.1::port/*
app.use('/stream/:port', (req, res, next) => {
    const targetPort = req.params.port;
    if (!targetPort || isNaN(Number(targetPort))) {
        return res.status(400).send('Invalid port');
    }
    (0, http_proxy_middleware_1.createProxyMiddleware)({
        target: `http://127.0.0.1:${targetPort}`,
        changeOrigin: true,
        ws: true, // proxy websockets as well if needed
        pathRewrite: {
            '^/stream/\\d+': '', // remove the /stream/:port part when forwarding
        },
        on: {
            error: (err, req, res) => {
                console.error(`[Proxy Error] Stream proxy to port ${targetPort} failed:`, err.message);
                if (!res.headersSent)
                    res.status(502).send('Bad Gateway - Stream offline');
            }
        }
    })(req, res, next);
});
// Main API Routes
app.use('/api', api_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'v380-nvr-backend' });
});
app.listen(PORT, () => {
    console.log(`[Backend] V380 NVR Backend running on http://localhost:${PORT}`);
});
