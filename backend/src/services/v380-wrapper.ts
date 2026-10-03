import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { recorderService } from './recorder';

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

interface DecoderInstance {
  process: ChildProcess;
  v380Id: string;
  status: 'starting' | 'running' | 'error' | 'stopped';
}

class V380DecoderService {
  private instances: Map<string, DecoderInstance> = new Map();
  private intentionalStops: Set<string> = new Set();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  // Resolve binary path based on platform
  private readonly binaryPath = process.platform === 'win32'
    ? path.join(getBackendDir(), 'bin', 'V380Decoder-win.exe')
    : path.join(getBackendDir(), 'bin', 'V380Decoder-linux');

  constructor() {
    this.init();
  }

  private async init() {
    console.log('[V380Decoder] Service initializing...');
    await this.logEvent('System', 'INFO', 'V380Decoder wrapper service starting');

    try {
      const cameras = await prisma.camera.findMany();
      for (const camera of cameras) {
        this.startCameraStream(camera.v380Id);
      }
    } catch (err: any) {
      console.error('[V380Decoder] Failed to load cameras during init:', err.message);
    }
  }

  public async startCameraStream(v380Id: string) {
    this.intentionalStops.delete(v380Id);

    const existingTimer = this.reconnectTimers.get(v380Id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.reconnectTimers.delete(v380Id);
    }

    if (this.instances.has(v380Id)) {
      console.log(`[V380Decoder] Stream for camera ${v380Id} is already running or starting.`);
      return;
    }

    const camera = await prisma.camera.findUnique({ where: { v380Id } });
    if (!camera) {
      throw new Error(`Camera ${v380Id} not found in database.`);
    }

    console.log(`[V380Decoder] Starting decoder for camera ${camera.name} (${v380Id})...`);
    await this.logEvent('V380Decoder', 'INFO', `Starting stream for camera ${camera.name}`);

    await prisma.camera.update({
      where: { v380Id },
      data: { status: 'starting' },
    });

    try {
      const args = [
        '--ip', camera.ip,
        '--port', camera.port.toString(),
        '--id', camera.v380Id,
        '--username', camera.username,
        '--password', camera.password,
        '--http-port', camera.httpPort.toString(),
        '--rtsp-port', camera.rtspPort.toString(),
        '--enable-api',
        '--enable-mjpeg',
      ];

      if (camera.hasOnvif) {
        args.push('--enable-onvif');
      }

      const binDir = path.dirname(this.binaryPath);
      const decoderProcess = spawn(this.binaryPath, args, {
        stdio: 'pipe',
        cwd: binDir,
        env: {
          ...process.env,
          LD_LIBRARY_PATH: `${binDir}:${process.env.LD_LIBRARY_PATH || ''}`,
        },
      });

      this.instances.set(v380Id, {
        process: decoderProcess,
        v380Id,
        status: 'starting',
      });

      decoderProcess.stdout.on('data', async (data) => {
        const output = data.toString();
        if (output.includes('ready') || output.includes('success') || output.includes('INFO') || output.includes('server')) {
          const instance = this.instances.get(v380Id);
          if (instance && instance.status !== 'running') {
            instance.status = 'running';
            await prisma.camera.update({ where: { v380Id }, data: { status: 'online' } });
            await this.logEvent('V380Decoder', 'INFO', `Camera ${camera.name} stream is now ONLINE`);

            if (camera.isRecording) {
              recorderService.startRecording(v380Id);
            }
          }
        }
      });

      decoderProcess.stderr.on('data', async (data) => {
        const errorMsg = data.toString();
        if (!errorMsg.includes('[FRAME] unknown type=')) {
          console.error(`[${v380Id} STDERR]:`, errorMsg);
        }

        if (errorMsg.includes('[STREAM] starting stream...') || errorMsg.includes('[MJPEG]') || errorMsg.includes('[STREAM] login OK')) {
          const instance = this.instances.get(v380Id);
          if (instance && instance.status !== 'running') {
            instance.status = 'running';
            await prisma.camera.update({ where: { v380Id }, data: { status: 'online' } });
            await this.logEvent('V380Decoder', 'INFO', `Camera ${camera.name} stream is now ONLINE`);

            if (camera.isRecording) {
              recorderService.startRecording(v380Id);
            }
          }
        }

        if (
          (errorMsg.toLowerCase().includes('error') || errorMsg.toLowerCase().includes('failed') || errorMsg.toLowerCase().includes('exception')) &&
          !errorMsg.includes('unknown type=0x18')
        ) {
          await this.logEvent('V380Decoder', 'ERROR', `Error on camera ${camera.name}: ${errorMsg.trim().substring(0, 200)}`);
        }
      });

      decoderProcess.on('close', async (code) => {
        console.log(`[V380Decoder] Decoder for camera ${v380Id} exited with code ${code}`);
        this.instances.delete(v380Id);
        await prisma.camera.update({ where: { v380Id }, data: { status: 'offline' } });
        await this.logEvent('V380Decoder', 'WARNING', `Camera ${camera.name} stream closed (Code: ${code})`);

        // Auto-reconnect jika bukan manual stop
        if (!this.intentionalStops.has(v380Id)) {
          console.log(`[V380Decoder] Camera ${v380Id} closed unexpectedly. Auto-reconnecting in 5s...`);
          const timer = setTimeout(async () => {
            this.reconnectTimers.delete(v380Id);
            try {
              const cam = await prisma.camera.findUnique({ where: { v380Id } });
              if (cam && !this.intentionalStops.has(v380Id)) {
                this.startCameraStream(v380Id);
              }
            } catch (err: any) {
              console.error(`[V380Decoder] Reconnect check failed for ${v380Id}:`, err.message);
            }
          }, 5000);
          this.reconnectTimers.set(v380Id, timer);
        }
      });

      decoderProcess.on('error', async (err) => {
        console.error(`[V380Decoder] Failed to start decoder process for ${v380Id}:`, err.message);
        this.instances.delete(v380Id);
        await prisma.camera.update({ where: { v380Id }, data: { status: 'error' } });
        await this.logEvent('System', 'ERROR', `Failed to start decoder binary: ${err.message}`);

        if (!this.intentionalStops.has(v380Id)) {
          const timer = setTimeout(async () => {
            this.reconnectTimers.delete(v380Id);
            try {
              const cam = await prisma.camera.findUnique({ where: { v380Id } });
              if (cam && !this.intentionalStops.has(v380Id)) {
                this.startCameraStream(v380Id);
              }
            } catch (e: any) {}
          }, 5000);
          this.reconnectTimers.set(v380Id, timer);
        }
      });
    } catch (error) {
      console.error(`[V380Decoder] Exception starting camera ${v380Id}:`, error);
    }
  }

  public async stopCameraStream(v380Id: string) {
    this.intentionalStops.add(v380Id);

    const timer = this.reconnectTimers.get(v380Id);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(v380Id);
    }

    const instance = this.instances.get(v380Id);
    if (instance) {
      console.log(`[V380Decoder] Stopping decoder for camera ${v380Id}...`);
      instance.process.kill('SIGTERM');
      this.instances.delete(v380Id);
      recorderService.stopRecording(v380Id);

      await prisma.camera.update({ where: { v380Id }, data: { status: 'offline' } });
      await this.logEvent('V380Decoder', 'INFO', `Stream for camera ${v380Id} manually stopped`);
      return true;
    }
    return false;
  }

  public stopAll() {
    console.log('[V380Decoder] Stopping all decoder instances for shutdown...');
    for (const [v380Id, timer] of this.reconnectTimers.entries()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    for (const [v380Id, instance] of this.instances.entries()) {
      this.intentionalStops.add(v380Id);
      try {
        instance.process.kill('SIGTERM');
      } catch (e) {}
    }
    this.instances.clear();
  }

  public async sendPtzCommand(v380Id: string, command: string, speed: number = 1) {
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
      if (cmdLower === 'up_left' || cmdLower === 'up_right') action = 'up';
      if (cmdLower === 'down_left' || cmdLower === 'down_right') action = 'down';

      if (action === 'stop') {
        return;
      }

      const ptzUrl = `http://127.0.0.1:${camera.httpPort}/api/ptz/${action}`;
      console.log(`[PTZ] Executing: POST ${ptzUrl}`);

      const response = await fetch(ptzUrl, { method: 'POST' });
      if (!response.ok) {
        console.warn(`[PTZ] Failed, API responded with status ${response.status}`);
      } else {
        console.log(`[PTZ] Command ${action} sent successfully`);
      }
    } catch (e: any) {
      console.error('[PTZ] Error execution:', e.message);
    }
  }

  public getStatus(v380Id: string) {
    return this.instances.get(v380Id)?.status || 'stopped';
  }

  public getAllInstances() {
    return Array.from(this.instances.values()).map((inst) => ({
      v380Id: inst.v380Id,
      status: inst.status,
    }));
  }

  private async logEvent(module: string, level: string, action: string, details?: string) {
    try {
      await prisma.systemLog.create({
        data: { module, level, action, details },
      });
    } catch (e) {
      console.error('[V380Decoder] Failed to write to system log:', e);
    }
  }
}

export const decoderService = new V380DecoderService();
