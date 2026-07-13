"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecordings = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const RECORDINGS_DIR = path_1.default.join(process.cwd(), 'recordings');
// Endpoint to list recording files
const getRecordings = (req, res) => {
    try {
        const { date } = req.query; // YYYY-MM-DD
        if (!fs_1.default.existsSync(RECORDINGS_DIR)) {
            return res.json([]);
        }
        const files = fs_1.default.readdirSync(RECORDINGS_DIR)
            .filter(file => file.endsWith('.mkv') || file.endsWith('.mp4'));
        // If a date is provided, filter files that contain that date in their name
        // Assuming V380Decoder saves files with date in the filename like "96555529_20260713_140000.mp4"
        const filtered = date
            ? files.filter(f => f.includes(date.replace(/-/g, '')))
            : files;
        const formattedFiles = filtered.map(file => {
            const stats = fs_1.default.statSync(path_1.default.join(RECORDINGS_DIR, file));
            return {
                filename: file,
                size: stats.size,
                createdAt: stats.birthtime
            };
        });
        res.json(formattedFiles);
    }
    catch (error) {
        console.error('Failed to get recordings:', error);
        res.status(500).json({ error: 'Failed to fetch recordings list' });
    }
};
exports.getRecordings = getRecordings;
