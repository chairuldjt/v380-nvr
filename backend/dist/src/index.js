"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const api_1 = __importDefault(require("./routes/api"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
// This will instantiate the service and auto-start cameras if configured
const v380_wrapper_1 = require("./services/v380-wrapper");
const recorder_1 = require("./services/recorder");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 5050 : 4000);
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
function getBackendDir() {
    let cur = __dirname;
    for (let i = 0; i < 4; i++) {
        if (fs_1.default.existsSync(path_1.default.join(cur, 'bin')) && (fs_1.default.existsSync(path_1.default.join(cur, 'package.json')) || fs_1.default.existsSync(path_1.default.join(cur, 'prisma')))) {
            return cur;
        }
        cur = path_1.default.dirname(cur);
    }
    return path_1.default.join(__dirname, '..');
}
function getFrontendOutDir() {
    const candidates = [
        path_1.default.join(path_1.default.dirname(getBackendDir()), 'frontend', 'out'),
        path_1.default.join(__dirname, '..', '..', 'frontend', 'out'),
        path_1.default.join(__dirname, '..', 'frontend', 'out'),
        process.resourcesPath ? path_1.default.join(process.resourcesPath, 'frontend', 'out') : '',
    ].filter(Boolean);
    for (const cand of candidates) {
        if (fs_1.default.existsSync(cand))
            return cand;
    }
    return null;
}
// Serve exported static frontend if available (Production / Desktop Mode)
const frontendOut = getFrontendOutDir();
if (frontendOut) {
    console.log(`[Backend] Serving static frontend from: ${frontendOut}`);
    app.use(express_1.default.static(frontendOut));
    app.use((req, res, next) => {
        if (req.method !== 'GET') {
            return next();
        }
        if (path_1.default.extname(req.path)) {
            return next();
        }
        const cleanPath = req.path.replace(/^\//, '');
        const exactHtml = path_1.default.join(frontendOut, `${cleanPath}.html`);
        if (cleanPath && fs_1.default.existsSync(exactHtml)) {
            return res.sendFile(exactHtml);
        }
        const subIndex = path_1.default.join(frontendOut, cleanPath, 'index.html');
        if (cleanPath && fs_1.default.existsSync(subIndex)) {
            return res.sendFile(subIndex);
        }
        const rootIndex = path_1.default.join(frontendOut, 'index.html');
        if (fs_1.default.existsSync(rootIndex)) {
            return res.sendFile(rootIndex);
        }
        next();
    });
}
const server = app.listen(PORT, () => {
    console.log(`[Backend] V380 NVR Backend running on http://localhost:${PORT}`);
});
const handleShutdown = (signal) => {
    console.log(`[Backend] Received ${signal}. Shutting down services cleanly...`);
    recorder_1.recorderService.stopAll();
    v380_wrapper_1.decoderService.stopAll();
    server.close(() => {
        console.log('[Backend] HTTP server closed.');
        process.exit(0);
    });
    // Force exit after 3 seconds if hanging
    setTimeout(() => process.exit(0), 3000);
};
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
