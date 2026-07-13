"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decoderService = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const recorder_1 = require("./recorder");
const prisma = new client_1.PrismaClient();
class V380DecoderService {
    instances = new Map();
    // Resolve binary path based on platform
    binaryPath = process.platform === 'win32'
        ? path_1.default.join(process.cwd(), 'bin', 'V380Decoder-win.exe')
        : path_1.default.join(process.cwd(), 'bin', 'V380Decoder-linux');
    constructor() {
        this.init();
    }
    async init() {
        console.log('V380DecoderService initializing...');
        await this.logEvent('System', 'INFO', 'V380Decoder wrapper service starting');
        // Automatically start streams for all cameras marked as 'online' or expected to run
        const cameras = await prisma.camera.findMany();
        for (const camera of cameras) {
            // Logic to autostart
            this.startCameraStream(camera.v380Id);
        }
    }
    async startCameraStream(v380Id) {
        if (this.instances.has(v380Id)) {
            console.log(`Stream for camera ${v380Id} is already running or attempting to start.`);
            return;
        }
        const camera = await prisma.camera.findUnique({ where: { v380Id } });
        if (!camera) {
            throw new Error(`Camera ${v380Id} not found in database.`);
        }
        console.log(`Starting decoder for camera ${camera.name} (${v380Id})...`);
        await this.logEvent('V380Decoder', 'INFO', `Starting stream for camera ${camera.name}`);
        // Update status in DB
        await prisma.camera.update({
            where: { v380Id },
            data: { status: 'starting' }
        });
        try {
            // Sesuaikan argumen dengan dokumentasi V380Decoder v1.0.3
            const args = [
                '--ip', camera.ip,
                '--port', camera.port.toString(),
                '--id', camera.v380Id,
                '--username', camera.username,
                '--password', camera.password,
                '--http-port', camera.httpPort.toString(),
                '--rtsp-port', camera.rtspPort.toString(),
                '--enable-api',
                '--enable-mjpeg'
            ];
            if (camera.hasOnvif) {
                args.push('--enable-onvif');
            }
            // Note: We use a placeholder logic here. If the binary does not exist, it will fail gracefully.
            const decoderProcess = (0, child_process_1.spawn)(this.binaryPath, args, { stdio: 'pipe' });
            this.instances.set(v380Id, {
                process: decoderProcess,
                v380Id,
                status: 'starting'
            });
            decoderProcess.stdout.on('data', async (data) => {
                const output = data.toString();
                // Fallback: If V380Decoder v1.0.3 doesn't explicitly print 'success', we mark it online if it starts printing stream details or starts the MJPEG server.
                // Some binaries just print INFO messages without a specific "ready" keyword.
                if (output.includes('ready') || output.includes('success') || output.includes('INFO') || output.includes('server')) {
                    const instance = this.instances.get(v380Id);
                    if (instance && instance.status !== 'running') {
                        instance.status = 'running';
                        await prisma.camera.update({ where: { v380Id }, data: { status: 'online' } });
                        await this.logEvent('V380Decoder', 'INFO', `Camera ${camera.name} stream is now ONLINE`);
                        // Start recording automatically if enabled
                        if (camera.isRecording) {
                            recorder_1.recorderService.startRecording(v380Id, camera.rtspPort);
                        }
                    }
                }
            });
            decoderProcess.stderr.on('data', async (data) => {
                const errorMsg = data.toString();
                // Skip logging verbose frame details to console unless debugging
                if (!errorMsg.includes('[FRAME] unknown type=')) {
                    console.error(`[${v380Id} STDERR]:`, errorMsg);
                }
                // V380Decoder v1.0.3 outputs all its main logs (including success logs) to STDERR.
                // Let's parse it here to detect successful stream start.
                if (errorMsg.includes('[STREAM] starting stream...') || errorMsg.includes('[MJPEG]') || errorMsg.includes('[STREAM] login OK')) {
                    const instance = this.instances.get(v380Id);
                    if (instance && instance.status !== 'running') {
                        instance.status = 'running';
                        await prisma.camera.update({ where: { v380Id }, data: { status: 'online' } });
                        await this.logEvent('V380Decoder', 'INFO', `Camera ${camera.name} stream is now ONLINE`);
                        // Start recording automatically if enabled
                        if (camera.isRecording) {
                            recorder_1.recorderService.startRecording(v380Id, camera.rtspPort);
                        }
                    }
                }
                // Log critical errors to database
                if ((errorMsg.toLowerCase().includes('error') || errorMsg.toLowerCase().includes('failed') || errorMsg.toLowerCase().includes('exception')) &&
                    !errorMsg.includes('unknown type=0x18') // Ignore harmless unknown frame types
                ) {
                    await this.logEvent('V380Decoder', 'ERROR', `Error on camera ${camera.name}: ${errorMsg.trim().substring(0, 200)}`);
                }
            });
            decoderProcess.on('close', async (code) => {
                console.log(`Decoder for camera ${v380Id} exited with code ${code}`);
                this.instances.delete(v380Id);
                recorder_1.recorderService.stopRecording(v380Id);
                await prisma.camera.update({ where: { v380Id }, data: { status: 'offline' } });
                await this.logEvent('V380Decoder', 'WARNING', `Camera ${camera.name} stream closed (Code: ${code})`);
                // Optional: Implement auto-restart logic here with setTimeout
            });
            decoderProcess.on('error', async (err) => {
                console.error(`Failed to start decoder process for ${v380Id}:`, err.message);
                this.instances.delete(v380Id);
                recorder_1.recorderService.stopRecording(v380Id);
                await prisma.camera.update({ where: { v380Id }, data: { status: 'error' } });
                await this.logEvent('System', 'ERROR', `Failed to start decoder binary: ${err.message}`);
            });
        }
        catch (error) {
            console.error(`Exception starting camera ${v380Id}:`, error);
        }
    }
    async stopCameraStream(v380Id) {
        const instance = this.instances.get(v380Id);
        if (instance) {
            console.log(`Stopping decoder for camera ${v380Id}...`);
            instance.process.kill('SIGTERM');
            this.instances.delete(v380Id);
            recorder_1.recorderService.stopRecording(v380Id);
            await prisma.camera.update({ where: { v380Id }, data: { status: 'offline' } });
            await this.logEvent('V380Decoder', 'INFO', `Stream for camera ${v380Id} manually stopped`);
            return true;
        }
        return false;
    }
    async sendPtzCommand(v380Id, command, speed = 1) {
        const instance = this.instances.get(v380Id);
        if (!instance) {
            console.warn('[PTZ] Stream not active, but sending command anyway for test.');
        }
        try {
            const camera = await prisma.camera.findUnique({ where: { v380Id } });
            if (!camera) {
                console.error('[PTZ] Camera DB not found');
                return;
            }
            const cmdLower = command.toLowerCase();
            let action = cmdLower;
            if (cmdLower === 'up_left' || cmdLower === 'up_right')
                action = 'up';
            if (cmdLower === 'down_left' || cmdLower === 'down_right')
                action = 'down';
            if (action === 'stop') {
                return;
            }
            const ptzUrl = `http://127.0.0.1:${camera.httpPort}/api/ptz/${action}`;
            console.log(`[PTZ] Executing: POST ${ptzUrl}`);
            const response = await fetch(ptzUrl, { method: 'POST' });
            if (!response.ok) {
                console.warn(`[PTZ] Failed, API responded with status ${response.status}`);
            }
            else {
                console.log(`[PTZ] Command ${action} sent successfully`);
            }
        }
        catch (e) {
            console.error('[PTZ] Error execution:', e.message);
        }
    }
    getStatus(v380Id) {
        return this.instances.get(v380Id)?.status || 'stopped';
    }
    getAllInstances() {
        return Array.from(this.instances.values()).map(inst => ({
            v380Id: inst.v380Id,
            status: inst.status
        }));
    }
    async logEvent(module, level, action, details) {
        try {
            await prisma.systemLog.create({
                data: { module, level, action, details }
            });
        }
        catch (e) {
            console.error('Failed to write to system log:', e);
        }
    }
}
exports.decoderService = new V380DecoderService();
