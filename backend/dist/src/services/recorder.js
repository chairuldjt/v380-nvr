"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recorderService = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const client_1 = require("@prisma/client");
const v380_wrapper_1 = require("./v380-wrapper");
const prisma = new client_1.PrismaClient();
const RECORDINGS_DIR = path_1.default.join(process.cwd(), 'recordings');
if (!fs_1.default.existsSync(RECORDINGS_DIR)) {
    fs_1.default.mkdirSync(RECORDINGS_DIR, { recursive: true });
}
class RecordingService {
    instances = new Map();
    constructor() {
        this.init();
    }
    async init() {
        console.log('RecordingService initializing...');
        setTimeout(async () => {
            const cameras = await prisma.camera.findMany({ where: { isRecording: true } });
            for (const camera of cameras) {
                this.startRecording(camera.v380Id);
            }
        }, 2000);
    }
    generateFilename(v380Id) {
        const d = new Date();
        const YYYY = d.getFullYear();
        const MM = String(d.getMonth() + 1).padStart(2, '0');
        const DD = String(d.getDate()).padStart(2, '0');
        const HH = String(d.getHours()).padStart(2, '0');
        const MIN = String(d.getMinutes()).padStart(2, '0');
        const SS = String(d.getSeconds()).padStart(2, '0');
        return path_1.default.join(RECORDINGS_DIR, `${v380Id}_${YYYY}${MM}${DD}_${HH}${MIN}${SS}.mkv`);
    }
    async startRecording(v380Id) {
        if (this.instances.has(v380Id)) {
            return;
        }
        const camera = await prisma.camera.findUnique({ where: { v380Id } });
        if (!camera)
            return;
        let rtspUrl = '';
        let isOnvifBypass = false;
        const wrapperStatus = v380_wrapper_1.decoderService.getStatus(v380Id);
        // PRIORITY: JIKA KAMERA SUPPORT ONVIF, SELALU GUNAKAN BYPASS!
        // V380 Decoder sering kali memberikan audio cacat/kosong yang membuat Node FFmpeg crash/0 bytes.
        if (camera.hasOnvif) {
            rtspUrl = `rtsp://${camera.username}:${camera.password}@${camera.ip}:554/live/ch0`;
            isOnvifBypass = true;
            console.log(`[REC] Connecting to DIRECT ONVIF Bypass RTSP for ${v380Id}...`);
        }
        else if (wrapperStatus === 'running' || camera.status === 'online') {
            rtspUrl = `rtsp://127.0.0.1:${camera.rtspPort}/live`;
            console.log(`[REC] Connecting to Local Decoder RTSP for ${v380Id}...`);
        }
        else {
            console.log(`[REC] Camera ${v380Id} is offline and has no ONVIF bypass. Cannot record.`);
            return;
        }
        const outputPath = this.generateFilename(v380Id);
        const args = [
            '-rtsp_transport', 'tcp',
            '-i', rtspUrl,
            '-t', '900',
            '-c:v', 'copy',
        ];
        if (isOnvifBypass) {
            // ONVIF Bypass:
            // Kita langsung COPY audio dari kamera. Tes manual via PowerShell membuktikan "-c:a copy"
            // menghasilkan suara yang bisa diputar di VLC/Player tanpa crash!
            args.push('-c:a', 'copy');
        }
        else {
            // Local Decoder stream (Audio: pcm_alaw) - ini sudah terbukti Anda bilang OKE!
            args.push('-c:a', 'aac', '-b:a', '32k', '-ar', '8000', '-ac', '1');
        }
        args.push('-f', 'matroska', '-y', outputPath);
        console.log(`[REC] Spawning 15-Min Chunk: ffmpeg -i <RTSP> -> ${path_1.default.basename(outputPath)} ${isOnvifBypass ? '(Audio: COPY)' : '(Audio: AAC)'}`);
        const recorderProcess = (0, child_process_1.spawn)('ffmpeg', args);
        recorderProcess.stderr.on('data', (data) => {
            const str = data.toString();
            if (str.toLowerCase().includes('error') || str.toLowerCase().includes('failed') || str.includes('Connection refused')) {
                console.error(`[REC FFmpeg ERROR] ${str.trim()}`);
            }
        });
        recorderProcess.on('close', (code) => {
            console.log(`[REC] 15-Min Chunk for ${v380Id} ended (Code: ${code}). Moving to next slice...`);
            this.instances.delete(v380Id);
            prisma.camera.findUnique({ where: { v380Id } }).then(cam => {
                if (cam && cam.isRecording) {
                    setTimeout(() => this.startRecording(v380Id), 2000);
                }
            });
        });
        recorderProcess.on('error', (err) => {
            console.error(`[REC] FFmpeg process error for ${v380Id}:`, err.message);
        });
        this.instances.set(v380Id, {
            process: recorderProcess,
            v380Id
        });
        await prisma.systemLog.create({
            data: {
                module: 'Recorder',
                level: 'INFO',
                action: `Started MKV 15-Min chunk for camera ${camera.name} (${v380Id})`
            }
        }).catch(e => null);
    }
    stopRecording(v380Id) {
        const instance = this.instances.get(v380Id);
        if (instance) {
            console.log(`[REC] Manually stopping recording for ${v380Id}...`);
            if (instance.process && !instance.process.killed) {
                try {
                    instance.process.stdin?.write('q\n');
                }
                catch (e) { }
                setTimeout(() => {
                    if (!instance.process.killed)
                        instance.process.kill('SIGKILL');
                }, 1500);
            }
            this.instances.delete(v380Id);
            return true;
        }
        return false;
    }
}
exports.recorderService = new RecordingService();
