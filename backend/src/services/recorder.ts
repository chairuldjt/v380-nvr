import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { decoderService } from './v380-wrapper';

const prisma = new PrismaClient();

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

const RECORDINGS_DIR = path.join(getBackendDir(), 'recordings');
const DEFAULT_TIMEZONE = 'Asia/Jakarta';

if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

/**
 * Ambil timezone dari SystemConfig DB. Fallback ke Asia/Jakarta jika tidak ada atau invalid.
 */
async function getConfiguredTimezone(): Promise<string> {
  try {
    const record = await prisma.systemConfig.findUnique({
      where: { key: 'timezone' },
    });
    const tz = record?.value || DEFAULT_TIMEZONE;

    // Validasi: jika timezone invalid, Intl.DateTimeFormat akan throw RangeError
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    console.warn(`[REC] Invalid or unavailable timezone setting, falling back to ${DEFAULT_TIMEZONE}`);
    return DEFAULT_TIMEZONE;
  }
}

function resolveFfmpegBinary(): string {
  const isWin = process.platform === 'win32';
  const candidate = isWin
    ? path.join(getBackendDir(), 'bin', 'ffmpeg.exe')
    : path.join(getBackendDir(), 'bin', 'ffmpeg');

  if (fs.existsSync(candidate)) {
    return candidate;
  }
  return 'ffmpeg';
}

interface RecorderInstance {
  process: ChildProcess;
  v380Id: string;
}

class RecordingService {
  private instances: Map<string, RecorderInstance> = new Map();
  private activeRecordingFiles: Map<string, string> = new Map();
  private pendingStarts: Set<string> = new Set();
  private intentionalStops: Set<string> = new Set();
  private isStoppedDueToLowDisk: boolean = false;
  private isPurging: boolean = false;

  constructor() {
    this.init();
    setInterval(() => this.checkDiskSpace(), 60000);
  }

  private async init() {
    console.log('[REC] RecordingService initializing...');
    // Beri waktu 10 detik agar V380Decoder selesai login & RTSP Server lokal siap
    setTimeout(async () => {
      try {
        const cameras = await prisma.camera.findMany({ where: { isRecording: true } });
        for (const camera of cameras) {
          this.startRecording(camera.v380Id);
        }
      } catch (err: any) {
        console.error('[REC] Failed to query cameras for initial recording:', err.message);
      }
    }, 10000);
  }

  public async startRecording(v380Id: string, immediate: boolean = false) {
    this.intentionalStops.delete(v380Id);

    if (this.instances.has(v380Id) || this.pendingStarts.has(v380Id)) {
      return;
    }

    if (this.isStoppedDueToLowDisk) {
      console.warn(`[REC] Cannot start recording for ${v380Id}: Storage is currently critically full.`);
      return;
    }

    if (immediate) {
      await this.executeStartRecording(v380Id);
      return;
    }

    this.pendingStarts.add(v380Id);

    // Beri jeda 5 detik untuk memastikan port RTSP di decoder benar-benar sudah listening
    setTimeout(async () => {
      this.pendingStarts.delete(v380Id);
      if (this.instances.has(v380Id) || this.intentionalStops.has(v380Id)) return;

      await this.executeStartRecording(v380Id);
    }, 5000);
  }

  private async executeStartRecording(v380Id: string) {
    const camera = await prisma.camera.findUnique({ where: { v380Id } });
    if (!camera) return;

    // Cek disk space sebelum spawn ffmpeg
    try {
      if (fs.existsSync(RECORDINGS_DIR)) {
        const stats = fs.statfsSync(RECORDINGS_DIR);
        const freeSpaceGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);

        const config = await prisma.systemConfig.findUnique({
          where: { key: 'minFreeSpaceGB' },
        });
        const rawMin = config ? Number(config.value) : 0;
        // Hard safety floor minimal 3 GB agar host OS & database tidak corrupt
        const minFreeSpaceGB = Math.max(rawMin, 3);

        if (freeSpaceGB <= minFreeSpaceGB) {
          await this.checkDiskSpace();
          const recheck = fs.statfsSync(RECORDINGS_DIR);
          const recheckFreeGB = (recheck.bavail * recheck.bsize) / (1024 * 1024 * 1024);
          if (recheckFreeGB <= minFreeSpaceGB) {
            console.warn(`[REC] Cannot start recording for ${v380Id}: Storage limit reached (${recheckFreeGB.toFixed(2)} GB free, limit ${minFreeSpaceGB} GB)`);
            return;
          }
        }
      }
    } catch (err: any) {
      console.error('[REC] Disk pre-check failed before starting recording:', err.message);
    }

    let rtspUrl = '';
    let isOnvifBypass = false;
    const wrapperStatus = decoderService.getStatus(v380Id);

    if (camera.hasOnvif) {
      rtspUrl = `rtsp://${camera.username}:${camera.password}@${camera.ip}:554/live/ch0`;
      isOnvifBypass = true;
      console.log(`[REC] Connecting to DIRECT ONVIF Bypass RTSP for ${v380Id}...`);
    } else if (wrapperStatus === 'running' || camera.status === 'online') {
      rtspUrl = `rtsp://127.0.0.1:${camera.rtspPort}/live`;
      console.log(`[REC] Connecting to Local Decoder RTSP for ${v380Id}...`);
    } else {
      console.log(`[REC] Camera ${v380Id} is offline and has no ONVIF bypass. Cannot record yet.`);
      return;
    }

    const timezone = await getConfiguredTimezone();
    const segmentPattern = path.join(RECORDINGS_DIR, `${v380Id}_%Y%m%d_%H%M%S.mkv`);

    const args = [
      '-fflags', '+genpts+nobuffer',
      '-rtsp_transport', 'tcp',
      '-timeout', '10000000', // 10 detik socket timeout (microsecond)
      '-i', rtspUrl,
      '-c:v', 'copy',
    ];

    if (isOnvifBypass) {
      args.push('-c:a', 'copy');
    } else {
      args.push('-c:a', 'aac', '-b:a', '32k', '-ar', '8000', '-ac', '1');
    }

    // Native continuous segmenter: 15 menit per chunk (900 detik) tanpa gap koneksi RTSP
    args.push(
      '-f', 'segment',
      '-segment_time', '900',
      '-reset_timestamps', '1',
      '-strftime', '1',
      '-segment_format', 'matroska',
      '-flush_packets', '1',
      segmentPattern
    );

    const ffmpegBin = resolveFfmpegBinary();
    console.log(`[REC] Spawning Continuous FFmpeg Segmenter for ${camera.name} (${v380Id}) using ${ffmpegBin} ${isOnvifBypass ? '[Audio: COPY]' : '[Audio: AAC]'}`);

    const recorderProcess = spawn(ffmpegBin, args, {
      env: {
        ...process.env,
        TZ: timezone,
      },
    });

    this.instances.set(v380Id, {
      process: recorderProcess,
      v380Id,
    });

    recorderProcess.stderr.on('data', (data) => {
      const str = data.toString();

      // Deteksi file chunk yang sedang aktif ditulis
      const match = str.match(/Opening '([^']+)' for writing/);
      if (match && match[1]) {
        this.activeRecordingFiles.set(v380Id, match[1]);
        console.log(`[REC] Active segment started: ${path.basename(match[1])}`);
      }

      if (
        str.toLowerCase().includes('error') ||
        str.toLowerCase().includes('failed') ||
        str.includes('Connection refused') ||
        str.includes('404 Not Found') ||
        str.includes('Invalid data') ||
        str.includes('timeout')
      ) {
        console.error(`[REC FFmpeg ERROR ${v380Id}] ${str.trim()}`);
      }
    });

    recorderProcess.on('close', (code) => {
      console.log(`[REC] Recording process for ${v380Id} ended (Code: ${code}).`);
      this.instances.delete(v380Id);
      this.activeRecordingFiles.delete(v380Id);

      // Auto-reconnect jika bukan manual stop dan bukan karena storage habis
      if (!this.intentionalStops.has(v380Id) && !this.isStoppedDueToLowDisk) {
        prisma.camera.findUnique({ where: { v380Id } }).then((cam) => {
          if (cam && cam.isRecording) {
            console.log(`[REC] Stream for ${v380Id} dropped unexpectedly. Reconnecting in 5s...`);
            setTimeout(() => {
              if (!this.intentionalStops.has(v380Id) && !this.isStoppedDueToLowDisk) {
                this.startRecording(v380Id, true);
              }
            }, 5000);
          }
        }).catch((err) => {
          console.error(`[REC] Error querying camera ${v380Id} on close:`, err.message);
        });
      }
    });

    recorderProcess.on('error', (err) => {
      console.error(`[REC] FFmpeg process error for ${v380Id}:`, err.message);
      this.instances.delete(v380Id);
      this.activeRecordingFiles.delete(v380Id);
    });

    await prisma.systemLog.create({
      data: {
        module: 'Recorder',
        level: 'INFO',
        action: `Memulai perekaman continuous 24/7 untuk kamera ${camera.name} (${v380Id})`,
      },
    }).catch(() => null);
  }

  public stopRecording(v380Id: string) {
    this.intentionalStops.add(v380Id);
    const instance = this.instances.get(v380Id);
    if (instance) {
      console.log(`[REC] Manually stopping recording for ${v380Id}...`);
      if (instance.process && !instance.process.killed) {
        try {
          instance.process.stdin?.write('q\n');
        } catch (e) {}
        setTimeout(() => {
          if (!instance.process.killed) instance.process.kill('SIGKILL');
        }, 1500);
      }
      this.instances.delete(v380Id);
      this.activeRecordingFiles.delete(v380Id);
      return true;
    }
    return false;
  }

  public stopAll() {
    console.log('[REC] Stopping all recording instances for shutdown...');
    for (const [v380Id, instance] of this.instances.entries()) {
      this.intentionalStops.add(v380Id);
      if (instance.process && !instance.process.killed) {
        try {
          instance.process.stdin?.write('q\n');
          setTimeout(() => {
            if (!instance.process.killed) instance.process.kill('SIGKILL');
          }, 1000);
        } catch (e) {}
      }
    }
    this.instances.clear();
    this.activeRecordingFiles.clear();
  }

  private stopAllDueToLowDisk() {
    this.isStoppedDueToLowDisk = true;
    for (const [v380Id, instance] of this.instances.entries()) {
      console.log(`[REC] Stopping recording for ${v380Id} due to low storage.`);
      if (instance.process && !instance.process.killed) {
        try {
          instance.process.stdin?.write('q\n');
        } catch (e) {}
        setTimeout(() => {
          if (!instance.process.killed) instance.process.kill('SIGKILL');
        }, 1500);
      }
      this.instances.delete(v380Id);
      this.activeRecordingFiles.delete(v380Id);
    }
  }

  private async resumeConfiguredRecordings() {
    try {
      const cameras = await prisma.camera.findMany({ where: { isRecording: true } });
      for (const camera of cameras) {
        if (!this.instances.has(camera.v380Id)) {
          this.startRecording(camera.v380Id, true);
        }
      }
    } catch (err: any) {
      console.error('[REC] Error resuming recordings after storage recovery:', err.message);
    }
  }

  public async checkDiskSpace() {
    if (this.isPurging) return;
    this.isPurging = true;

    try {
      if (!fs.existsSync(RECORDINGS_DIR)) return;

      // 1. Ambil konfigurasi storage dari database
      const configs = await prisma.systemConfig.findMany({
        where: {
          key: { in: ['minFreeSpaceGB', 'maxStorageGB', 'retentionDays', 'autoDelete'] },
        },
      });

      const configMap: Record<string, string> = {};
      for (const c of configs) {
        configMap[c.key] = c.value;
      }

      const rawMinFreeSpace = Number(configMap['minFreeSpaceGB'] || 0);
      // Hard safety floor minimal 3 GB agar OS dan SQLite tidak crash jika setting 0
      const minFreeSpaceGB = Math.max(rawMinFreeSpace, 3);
      const maxStorageGB = Number(configMap['maxStorageGB'] || 0);
      const retentionDays = Number(configMap['retentionDays'] || 0);
      const autoDelete = configMap['autoDelete'] !== 'false';

      // 2. Scan file rekaman yang ada di folder
      const allFiles = fs.readdirSync(RECORDINGS_DIR)
        .filter((f) => f.endsWith('.mkv') || f.endsWith('.mp4'));

      const now = Date.now();
      const activeFilePaths = new Set(this.activeRecordingFiles.values());

      const fileDetails: Array<{ path: string; name: string; size: number; mtime: number }> = [];
      let totalRecordingsBytes = 0;

      for (const file of allFiles) {
        const fullPath = path.join(RECORDINGS_DIR, file);
        try {
          const stat = fs.statSync(fullPath);
          totalRecordingsBytes += stat.size;
          fileDetails.push({
            path: fullPath,
            name: file,
            size: stat.size,
            mtime: stat.mtimeMs,
          });
        } catch {
          // File mungkin sedang ditangani proses lain
        }
      }

      // Urutkan dari yang paling lama (mtime ascending)
      fileDetails.sort((a, b) => a.mtime - b.mtime);

      let deletedCount = 0;

      // A. PURGE BERDASARKAN RETENSI (File lebih tua dari retentionDays)
      if (autoDelete && retentionDays > 0) {
        const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
        for (const item of fileDetails) {
          if (activeFilePaths.has(item.path)) continue;
          // Proteksi: jangan hapus file yang dimodifikasi kurang dari 20 menit lalu
          if (now - item.mtime < 20 * 60 * 1000) continue;

          if (now - item.mtime > maxAgeMs) {
            try {
              fs.unlinkSync(item.path);
              deletedCount++;
              totalRecordingsBytes -= item.size;
              console.log(`[REC Purge] Expired retention (> ${retentionDays}d): ${item.name}`);
            } catch (e: any) {
              console.error(`[REC Purge] Failed to delete ${item.name}:`, e.message);
            }
          }
        }
      }

      // B. PURGE BERDASARKAN KUOTA FOLDER (totalRecordingsBytes > maxStorageGB)
      if (autoDelete && maxStorageGB > 0) {
        const maxStorageBytes = maxStorageGB * 1024 * 1024 * 1024;
        const targetQuotaBytes = maxStorageBytes * 0.9; // Beri ruang napas hingga 90% kuota

        if (totalRecordingsBytes > maxStorageBytes) {
          console.log(`[REC Purge] Quota reached: ${(totalRecordingsBytes / (1024 * 1024 * 1024)).toFixed(2)} GB > ${maxStorageGB} GB. Purging down to 90%...`);
          for (const item of fileDetails) {
            if (totalRecordingsBytes <= targetQuotaBytes) break;
            if (activeFilePaths.has(item.path)) continue;
            if (now - item.mtime < 20 * 60 * 1000) continue;
            if (!fs.existsSync(item.path)) continue;

            try {
              fs.unlinkSync(item.path);
              deletedCount++;
              totalRecordingsBytes -= item.size;
              console.log(`[REC Purge] Quota limit: deleted ${item.name}`);
            } catch (e: any) {
              console.error(`[REC Purge] Failed to delete ${item.name}:`, e.message);
            }
          }
        }
      }

      // C. PURGE BERDASARKAN KAPASITAS FISIK DISK (freeSpaceGB <= minFreeSpaceGB)
      const currentStats = fs.statfsSync(RECORDINGS_DIR);
      let curFreeBytes = currentStats.bavail * currentStats.bsize;
      let curFreeGB = curFreeBytes / (1024 * 1024 * 1024);

      if (curFreeGB <= minFreeSpaceGB) {
        if (autoDelete) {
          const targetFreeBytes = (minFreeSpaceGB + 3) * 1024 * 1024 * 1024;
          console.log(`[REC Purge] Low disk space (${curFreeGB.toFixed(2)} GB free <= ${minFreeSpaceGB} GB). Purging oldest recordings...`);

          for (const item of fileDetails) {
            if (curFreeBytes >= targetFreeBytes) break;
            if (activeFilePaths.has(item.path)) continue;
            if (now - item.mtime < 20 * 60 * 1000) continue;
            if (!fs.existsSync(item.path)) continue;

            try {
              fs.unlinkSync(item.path);
              deletedCount++;
              curFreeBytes += item.size;
              console.log(`[REC Purge] Low disk: deleted ${item.name}`);
            } catch (e: any) {
              console.error(`[REC Purge] Failed to delete ${item.name}:`, e.message);
            }
          }
        }

        // Cek ulang kapasitas disk setelah purge
        const finalStats = fs.statfsSync(RECORDINGS_DIR);
        const finalFreeGB = (finalStats.bavail * finalStats.bsize) / (1024 * 1024 * 1024);

        if (finalFreeGB <= minFreeSpaceGB) {
          console.error(`[REC] CRITICAL: Storage space critically low (${finalFreeGB.toFixed(2)} GB free <= ${minFreeSpaceGB} GB)! Pausing recordings to protect OS.`);
          await prisma.systemLog.create({
            data: {
              module: 'Recorder',
              level: 'ERROR',
              action: `Perekaman dihentikan darurat: Ruang disk kritis (${finalFreeGB.toFixed(2)} GB tersisa, batas aman ${minFreeSpaceGB} GB).`,
            },
          }).catch(() => null);

          this.stopAllDueToLowDisk();
        }
      } else if (this.isStoppedDueToLowDisk && curFreeGB > minFreeSpaceGB + 2) {
        // Pemulihan otomatis jika disk space sudah kembali longgar
        console.log(`[REC] Storage space recovered (${curFreeGB.toFixed(2)} GB free). Resuming recordings...`);
        this.isStoppedDueToLowDisk = false;
        await prisma.systemLog.create({
          data: {
            module: 'Recorder',
            level: 'INFO',
            action: `Ruang penyimpanan kembali aman (${curFreeGB.toFixed(2)} GB tersisa). Melanjutkan perekaman otomatis.`,
          },
        }).catch(() => null);

        await this.resumeConfiguredRecordings();
      }

      if (deletedCount > 0) {
        await prisma.systemLog.create({
          data: {
            module: 'Recorder',
            level: 'INFO',
            action: `Pembersihan otomatis: Berhasil menghapus ${deletedCount} file rekaman lama (retensi / kuota / proteksi disk).`,
          },
        }).catch(() => null);
      }
    } catch (err: any) {
      console.error('[REC] Error checking disk space:', err.message);
    } finally {
      this.isPurging = false;
    }
  }
}

export const recorderService = new RecordingService();
