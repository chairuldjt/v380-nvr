import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { decoderService } from '../services/v380-wrapper';
import { recorderService } from '../services/recorder';

const prisma = new PrismaClient();

export const getCameras = async (req: Request, res: Response) => {
  try {
    const cameras = await prisma.camera.findMany({
      orderBy: { createdAt: 'asc' }
    });
    res.json(cameras);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cameras' });
  }
};

export const getCamera = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const camera = await prisma.camera.findUnique({
      where: { v380Id: id }
    });

    if (!camera) return res.status(404).json({ error: 'Camera not found' });
    res.json(camera);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch camera' });
  }
};

export const createCamera = async (req: Request, res: Response) => {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to create camera' });
  }
};

export const updateCamera = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = req.body;

    const updated = await prisma.camera.update({
      where: { v380Id: id },
      data
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update camera' });
  }
};

export const deleteCamera = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Stop stream if running
    await decoderService.stopCameraStream(id);

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
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete camera' });
  }
};

// Stream control
export const startCamera = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await decoderService.startCameraStream(id);
    res.json({ success: true, message: 'Stream start initiated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start camera stream' });
  }
};

export const stopCamera = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const stopped = await decoderService.stopCameraStream(id);
    res.json({ success: stopped, message: stopped ? 'Stream stopped' : 'Stream not running' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop camera stream' });
  }
};

// PTZ Control endpoint
export const controlPtz = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { command, speed = 1 } = req.body;

    // Kirim request ke wrapper atau V380 API/ONVIF
    await decoderService.sendPtzCommand(id, command, speed);
    res.json({ success: true, message: `PTZ command ${command} executed` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute PTZ command' });
  }
};

// Recording Control Endpoint
export const toggleRecording = async (req: Request, res: Response) => {
  try {
    const v380Id = req.params.id as string;
    const { isRecording } = req.body;

    const camera = await prisma.camera.update({
      where: { v380Id },
      data: { isRecording }
    });

    if (isRecording) {
      if (camera.status === 'online') {
        recorderService.startRecording(camera.v380Id);
      }
    } else {
      recorderService.stopRecording(camera.v380Id);
    }

    res.json({ success: true, isRecording, message: `Recording is now ${isRecording ? 'ON' : 'OFF'}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle recording status' });
  }
};
