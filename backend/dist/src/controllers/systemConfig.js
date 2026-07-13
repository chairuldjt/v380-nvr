"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSystemConfig = exports.getSystemConfig = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Default values if not set
const defaultConfigs = [
    { key: 'retentionDays', value: '7', description: 'Number of days to keep recordings' },
    { key: 'autoDelete', value: 'true', description: 'Automatically delete oldest recordings when full or expired' },
    { key: 'maxStorageGB', value: '500', description: 'Maximum storage limit for recordings in GB' }
];
const getSystemConfig = async (req, res) => {
    try {
        const configs = await prisma.systemConfig.findMany();
        // Convert to a simple Key-Value object
        const configMap = {};
        // Populate defaults first
        defaultConfigs.forEach(def => {
            configMap[def.key] = def.value;
        });
        // Override with DB values
        configs.forEach(conf => {
            configMap[conf.key] = conf.value;
        });
        // Type casting for boolean and numbers
        if (configMap.autoDelete === 'true' || configMap.autoDelete === 'false') {
            configMap.autoDelete = configMap.autoDelete === 'true';
        }
        if (!isNaN(Number(configMap.retentionDays))) {
            configMap.retentionDays = Number(configMap.retentionDays);
        }
        if (!isNaN(Number(configMap.maxStorageGB))) {
            configMap.maxStorageGB = Number(configMap.maxStorageGB);
        }
        res.json(configMap);
    }
    catch (error) {
        console.error('Failed to get system configs:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};
exports.getSystemConfig = getSystemConfig;
const updateSystemConfig = async (req, res) => {
    try {
        const updates = req.body; // Expects object: { retentionDays: 14, autoDelete: true, ... }
        const operations = Object.keys(updates).map(async (key) => {
            const valStr = String(updates[key]);
            return prisma.systemConfig.upsert({
                where: { key },
                update: { value: valStr },
                create: { key, value: valStr, description: `Set from UI: ${key}` }
            });
        });
        await Promise.all(operations);
        res.json({ message: 'System configurations updated successfully' });
    }
    catch (error) {
        console.error('Failed to update system configs:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};
exports.updateSystemConfig = updateSystemConfig;
