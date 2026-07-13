import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getLiveLayout = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user.id;
    const pref = await prisma.userPreference.findUnique({
      where: { userId }
    });
    
    if (pref && pref.liveLayout) {
      res.json(JSON.parse(pref.liveLayout));
    } else {
      res.json({ gridSize: 4, cellMap: {} }); // default
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch layout preferences' });
  }
};

export const saveLiveLayout = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user.id;
    const { gridSize, cellMap } = req.body;
    
    const layoutStr = JSON.stringify({ gridSize, cellMap });
    
    await prisma.userPreference.upsert({
      where: { userId },
      update: { liveLayout: layoutStr },
      create: { userId, liveLayout: layoutStr }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save layout preferences' });
  }
};
