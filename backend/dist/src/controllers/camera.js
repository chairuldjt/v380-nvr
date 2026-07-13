"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleRecording = exports.controlPtz = exports.stopCamera = exports.startCamera = exports.deleteCamera = exports.updateCamera = exports.createCamera = exports.getCamera = exports.getCameras = void 0;
const client_1 = require("@prisma/client");
const v380_wrapper_1 = require("../services/v380-wrapper");
const recorder_1 = require("../services/recorder");
const prisma = new client_1.PrismaClient();
const getCameras = async (req, res) => {
    try {
        const cameras = await prisma.camera.findMany({
            orderBy: { createdAt: 'asc' }
        });
        res.json(cameras);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch cameras' });
    }
};
exports.getCameras = getCameras;
const getCamera = async (req, res) => {
    try {
        const id = req.params.id;
        const camera = await prisma.camera.findUnique({
            where: { v380Id: id }
        });
        if (!camera)
            return res.status(404).json({ error: 'Camera not found' });
        res.json(camera);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch camera' });
    }
};
exports.getCamera = getCamera;
const createCamera = async (req, res) => {
    try {
        const data = req.body;
        const newCamera = await prisma.camera.create({
            data: {
                name: data.name,
                v380Id: data.v380Id,
                ip: data.ip,
                port: data.port || 8800,
                username: data.username,
                password: data.password,
                httpPort: data.httpPort,
                rtspPort: data.rtspPort,
                hasOnvif: data.hasOnvif || false,
                status: 'offline'
            }
        });
        await prisma.systemLog.create({
            data: {
                action: 'CAMERA_ADD',
                details: `Camera ${newCamera.name} (${newCamera.v380Id}) added`,
                module: 'Config',
                level: 'INFO'
            }
        });
        res.status(201).json(newCamera);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create camera' });
    }
};
exports.createCamera = createCamera;
const updateCamera = async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;
        const updated = await prisma.camera.update({
            where: { v380Id: id },
            data
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update camera' });
    }
};
exports.updateCamera = updateCamera;
const deleteCamera = async (req, res) => {
    try {
        const id = req.params.id;
        // Stop stream if running
        await v380_wrapper_1.decoderService.stopCameraStream(id);
        await prisma.camera.delete({
            where: { v380Id: id }
        });
        await prisma.systemLog.create({
            data: {
                action: 'CAMERA_DELETE',
                details: `Camera ID ${id} deleted`,
                module: 'Config',
                level: 'WARNING'
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete camera' });
    }
};
exports.deleteCamera = deleteCamera;
// Stream control
const startCamera = async (req, res) => {
    try {
        const id = req.params.id;
        await v380_wrapper_1.decoderService.startCameraStream(id);
        res.json({ success: true, message: 'Stream start initiated' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to start camera stream' });
    }
};
exports.startCamera = startCamera;
const stopCamera = async (req, res) => {
    try {
        const id = req.params.id;
        const stopped = await v380_wrapper_1.decoderService.stopCameraStream(id);
        res.json({ success: stopped, message: stopped ? 'Stream stopped' : 'Stream not running' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to stop camera stream' });
    }
};
exports.stopCamera = stopCamera;
// PTZ Control endpoint
const controlPtz = async (req, res) => {
    try {
        const id = req.params.id;
        const { command, speed = 1 } = req.body;
        // Kirim request ke wrapper atau V380 API/ONVIF
        await v380_wrapper_1.decoderService.sendPtzCommand(id, command, speed);
        res.json({ success: true, message: `PTZ command ${command} executed` });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to execute PTZ command' });
    }
};
exports.controlPtz = controlPtz;
// Recording Control Endpoint
const toggleRecording = async (req, res) => {
    try {
        const v380Id = req.params.id;
        const { isRecording } = req.body;
        const camera = await prisma.camera.update({
            where: { v380Id },
            data: { isRecording }
        });
        if (isRecording) {
            if (camera.status === 'online') {
                recorder_1.recorderService.startRecording(camera.v380Id);
            }
        }
        else {
            recorder_1.recorderService.stopRecording(camera.v380Id);
        }
        res.json({ success: true, isRecording, message: `Recording is now ${isRecording ? 'ON' : 'OFF'}` });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to toggle recording status' });
    }
};
exports.toggleRecording = toggleRecording;
