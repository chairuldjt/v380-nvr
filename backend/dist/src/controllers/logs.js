"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogs = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getLogs = async (req, res) => {
    try {
        const { type, module, limit = 100 } = req.query;
        const where = {};
        if (type && type !== 'all')
            where.level = type.toUpperCase();
        if (module && module !== 'all-modules')
            where.module = module;
        const logs = await prisma.systemLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};
exports.getLogs = getLogs;
