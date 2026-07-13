"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const systemConfig_1 = require("../controllers/systemConfig");
const users_1 = require("../controllers/users");
const userPreference_1 = require("../controllers/userPreference");
const express_1 = require("express");
const auth_1 = require("../controllers/auth");
const auth_2 = require("../middleware/auth");
const camera_1 = require("../controllers/camera");
const logs_1 = require("../controllers/logs");
const playback_1 = require("../controllers/playback");
const express_2 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
// Serve static recordings directly
router.use('/recordings/stream', express_2.default.static(path_1.default.join(process.cwd(), 'recordings')));
// Playback endpoints
router.get('/recordings', playback_1.getRecordings);
// Auth endpoint
router.post('/auth/login', auth_1.login);
// Protect all following routes with authenticateToken middleware
router.use(auth_2.authenticateToken);
// Cameras endpoints (Read-only for all, write for admin)
router.get('/cameras', camera_1.getCameras);
router.get('/cameras/:id', camera_1.getCamera);
router.post('/cameras', auth_2.requireAdmin, camera_1.createCamera);
router.put('/cameras/:id', auth_2.requireAdmin, camera_1.updateCamera);
router.delete('/cameras/:id', auth_2.requireAdmin, camera_1.deleteCamera);
// Decoder controls (Operator can control streams, PTZ, and record)
router.post('/cameras/:id/start', camera_1.startCamera);
router.post('/cameras/:id/stop', camera_1.stopCamera);
router.post('/cameras/:id/ptz', camera_1.controlPtz);
router.post('/cameras/:id/record', camera_1.toggleRecording);
// Logs (Admin only)
router.get('/logs', auth_2.requireAdmin, logs_1.getLogs);
// User Preferences (User specific)
router.get('/preferences/live-layout', userPreference_1.getLiveLayout);
router.post('/preferences/live-layout', userPreference_1.saveLiveLayout);
// System Config (Admin only)
router.get('/system/config', auth_2.requireAdmin, systemConfig_1.getSystemConfig);
router.post('/system/config', auth_2.requireAdmin, systemConfig_1.updateSystemConfig);
// Users Management (Admin only)
router.get('/users', auth_2.requireAdmin, users_1.getUsers);
router.post('/users', auth_2.requireAdmin, users_1.createUser);
router.put('/users/:id', auth_2.requireAdmin, users_1.updateUser);
router.delete('/users/:id', auth_2.requireAdmin, users_1.deleteUser);
exports.default = router;
