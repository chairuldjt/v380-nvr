"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveLiveLayout = exports.getLiveLayout = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getLiveLayout = async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.user.id;
        const pref = await prisma.userPreference.findUnique({
            where: { userId }
        });
        if (pref && pref.liveLayout) {
            res.json(JSON.parse(pref.liveLayout));
        }
        else {
            res.json({ gridSize: 4, cellMap: {} }); // default
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch layout preferences' });
    }
};
exports.getLiveLayout = getLiveLayout;
const saveLiveLayout = async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to save layout preferences' });
    }
};
exports.saveLiveLayout = saveLiveLayout;
