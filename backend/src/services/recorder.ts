import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { decoderService } from './v380-wrapper';

const prisma = new PrismaClient();
// __dirname selalu relatif terhadap lokasi file ini (services/),
// jadi naik 2 level ke root backend/ lalu masuk ke recordings/
// Ini KONSISTEN di dev maupun prod, tidak tergantung dari mana process dijalankan.
const RECORDINGS_DIR = path.join(__dirname, '..', '..', 'recordings');

if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

interface RecorderInstance {
  process: ChildProcess;
  v380Id: string;
}

class RecordingService {
  private instances: Map<string, RecorderInstance> = new Map();

  constructor() {
    this.init();
  }

  private async init() {
    console.log('RecordingService initializing...');
    // Beri waktu 10 detik agar V380Decoder selesai login & RTSP Server lokal siap
    setTimeout(async () => {
      const cameras = await prisma.camera.findMany({ where: { isRecording: true } });
      for (const camera of cameras) {
        this.startRecording(camera.v380Id);
      }
    }, 10000);
  }

  private generateFilename(v380Id: string) {
    // Selalu gunakan timezone Asia/Jakarta (WIB) agar nama file konsisten
    // di server manapun (UTC, WIB, dll) dan cocok dengan filter tanggal di browser user.
    const now = new Date();
    // Hitung offset WIB (UTC+7) secara manual — tidak tergantung timezone OS
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utcMs + 7 * 3600000);

    const YYYY = wib.getFullYear();
    const MM = String(wib.getMonth() + 1).padStart(2, '0');
    const DD = String(wib.getDate()).padStart(2, '0');
    const HH = String(wib.getHours()).padStart(2, '0');
    const MIN = String(wib.getMinutes()).padStart(2, '0');
    const SS = String(wib.getSeconds()).padStart(2, '0');
    return path.join(RECORDINGS_DIR, `${v380Id}_${YYYY}${MM}${DD}_${HH}${MIN}${SS}.mkv`);
  }

  private pendingStarts: Set<string> = new Set();

  public async startRecording(v380Id: string) {
    if (this.instances.has(v380Id) || this.pendingStarts.has(v380Id)) {
      return;
    }

    this.pendingStarts.add(v380Id);

    // Beri jeda 5 detik untuk memastikan port RTSP di decoder benar-benar sudah listening & mengalirkan frame video
    setTimeout(async () => {
      this.pendingStarts.delete(v380Id);
      if (this.instances.has(v380Id)) return;

      await this.executeStartRecording(v380Id);
    }, 5000);
  }

  private async executeStartRecording(v380Id: string) {

    const camera = await prisma.camera.findUnique({ where: { v380Id } });
    if (!camera) return;

    let rtspUrl = '';
    let isOnvifBypass = false;
    
    const wrapperStatus = decoderService.getStatus(v380Id);

    // PRIORITY: JIKA KAMERA SUPPORT ONVIF, SELALU GUNAKAN BYPASS!
    // V380 Decoder sering kali memberikan audio cacat/kosong yang membuat Node FFmpeg crash/0 bytes.
    if (camera.hasOnvif) {
       rtspUrl = `rtsp://${camera.username}:${camera.password}@${camera.ip}:554/live/ch0`;
       isOnvifBypass = true;
       console.log(`[REC] Connecting to DIRECT ONVIF Bypass RTSP for ${v380Id}...`);
    } else if (wrapperStatus === 'running' || camera.status === 'online') {
       rtspUrl = `rtsp://127.0.0.1:${camera.rtspPort}/live`;
       console.log(`[REC] Connecting to Local Decoder RTSP for ${v380Id}...`);
    } else {
       console.log(`[REC] Camera ${v380Id} is offline and has no ONVIF bypass. Cannot record.`);
       return;
    }

    const outputPath = this.generateFilename(v380Id);
    
    const args = [
      '-fflags', '+genpts+nobuffer', // Jangan ditahan di memori, langsung proses & perbaiki timestamp
      '-rtsp_transport', 'tcp',
      '-timeout', '10000000', // 10 detik socket timeout (microsecond) agar tidak hang selamanya
      '-i', rtspUrl,
      '-t', '900',
      '-c:v', 'copy',
    ];

    if (isOnvifBypass) {
      // ONVIF Bypass:
      // Kita langsung COPY audio dari kamera. Tes manual via PowerShell membuktikan "-c:a copy"
      // menghasilkan suara yang bisa diputar di VLC/Player tanpa crash!
      args.push('-c:a', 'copy');
    } else {
      // Local Decoder stream (Audio: pcm_alaw) - ini sudah terbukti Anda bilang OKE!
      args.push('-c:a', 'aac', '-b:a', '32k', '-ar', '8000', '-ac', '1');
    }

    args.push(
      '-flush_packets', '1', // Langsung tulis tiap packet ke disk (jangan ditahan di RAM)
      '-f', 'matroska',
      '-y',
      outputPath
    );

    console.log(`[REC] Spawning 15-Min Chunk: ffmpeg -i <RTSP> -> ${path.basename(outputPath)} ${isOnvifBypass ? '(Audio: COPY)' : '(Audio: AAC)'}`);

    const recorderProcess = spawn('ffmpeg', args);

    recorderProcess.stderr.on('data', (data) => {
      const str = data.toString();
      // Jangan disembunyikan jika ada error atau not found dari ffmpeg
      if (
        str.toLowerCase().includes('error') ||
        str.toLowerCase().includes('failed') ||
        str.includes('Connection refused') ||
        str.includes('404 Not Found') ||
        str.includes('Invalid data') ||
        str.includes('timeout')
      ) {
         console.error(`[REC FFmpeg ERROR] ${str.trim()}`);
      }
    });

    recorderProcess.on('close', (code) => {
      console.log(`[REC] 15-Min Chunk for ${v380Id} ended (Code: ${code}). Moving to next slice...`);
      this.instances.delete(v380Id);

      prisma.camera.findUnique({ where: { v380Id } }).then(cam => {
         if (cam && cam.isRecording) {
            // Beri jeda agak lama saat restart slice jika crash (5 detik)
            setTimeout(() => this.startRecording(v380Id), 5000);
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

  public stopRecording(v380Id: string) {
    const instance = this.instances.get(v380Id);
    if (instance) {
      console.log(`[REC] Manually stopping recording for ${v380Id}...`);
      if (instance.process && !instance.process.killed) {
        try { instance.process.stdin?.write('q\n'); } catch (e) {}
        setTimeout(() => {
           if (!instance.process.killed) instance.process.kill('SIGKILL');
        }, 1500);
      }
      this.instances.delete(v380Id);
      return true;
    }
    return false;
  }
}

export const recorderService = new RecordingService();
