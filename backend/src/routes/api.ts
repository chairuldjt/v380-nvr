import { getSystemConfig, updateSystemConfig } from "../controllers/systemConfig";
import { getUsers, createUser, updateUser, deleteUser } from "../controllers/users";
import { getLiveLayout, saveLiveLayout } from "../controllers/userPreference";
import { Router } from 'express';
import { login } from '../controllers/auth';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import {
  getCameras,
  getCamera,
  createCamera,
  updateCamera,
  deleteCamera,
  startCamera,
  stopCamera,
  controlPtz,
  toggleRecording
} from '../controllers/camera';
import { getLogs } from '../controllers/logs';
import { getRecordings } from '../controllers/playback';
import express from 'express';
import path from 'path';
import fs from 'fs';

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

const router = Router();

// Serve static recordings directly
router.use('/recordings/stream', express.static(path.join(getBackendDir(), 'recordings')));

// Playback endpoints
router.get('/recordings', getRecordings);

// Auth endpoint
router.post('/auth/login', login);

// Protect all following routes with authenticateToken middleware
router.use(authenticateToken);

// Cameras endpoints (Read-only for all, write for admin)
router.get('/cameras', getCameras);
router.get('/cameras/:id', getCamera);
router.post('/cameras', requireAdmin, createCamera);
router.put('/cameras/:id', requireAdmin, updateCamera);
router.delete('/cameras/:id', requireAdmin, deleteCamera);

// Decoder controls (Operator can control streams, PTZ, and record)
router.post('/cameras/:id/start', startCamera);
router.post('/cameras/:id/stop', stopCamera);
router.post('/cameras/:id/ptz', controlPtz);
router.post('/cameras/:id/record', toggleRecording);

// Logs (Admin only)
router.get('/logs', requireAdmin, getLogs);

// User Preferences (User specific)
router.get('/preferences/live-layout', getLiveLayout);
router.post('/preferences/live-layout', saveLiveLayout);

// System Config (Admin only)
router.get('/system/config', requireAdmin, getSystemConfig);
router.post('/system/config', requireAdmin, updateSystemConfig);

// Users Management (Admin only)
router.get('/users', requireAdmin, getUsers);
router.post('/users', requireAdmin, createUser);
router.put('/users/:id', requireAdmin, updateUser);
router.delete('/users/:id', requireAdmin, deleteUser);

export default router;
