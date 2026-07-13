import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';

const RECORDINGS_DIR = path.join(process.cwd(), 'recordings');

// Endpoint to list recording files
export const getRecordings = (req: Request, res: Response) => {
  try {
    const { date } = req.query; // YYYY-MM-DD

    if (!fs.existsSync(RECORDINGS_DIR)) {
      return res.json([]);
    }

    const files = fs.readdirSync(RECORDINGS_DIR)
      .filter(file => file.endsWith('.mkv') || file.endsWith('.mp4'));

    // If a date is provided, filter files that contain that date in their name
    // Assuming V380Decoder saves files with date in the filename like "96555529_20260713_140000.mp4"
    const filtered = date
      ? files.filter(f => f.includes((date as string).replace(/-/g, '')))
      : files;

    const formattedFiles = filtered.map(file => {
      const stats = fs.statSync(path.join(RECORDINGS_DIR, file));
      return {
        filename: file,
        size: stats.size,
        createdAt: stats.birthtime
      };
    });

    res.json(formattedFiles);
  } catch (error) {
    console.error('Failed to get recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings list' });
  }
};
