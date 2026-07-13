import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getLogs = async (req: Request, res: Response) => {
  try {
    const { type, module, limit = 100 } = req.query;

    const where: any = {};
    if (type && type !== 'all') where.level = (type as string).toUpperCase();
    if (module && module !== 'all-modules') where.module = module as string;

    const logs = await prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit)
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};
