"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.createUser = exports.getUsers = void 0;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
const getUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                role: true,
                createdAt: true,
            },
        });
        res.json(users);
    }
    catch (error) {
        console.error('Failed to get users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};
exports.getUsers = getUsers;
const createUser = async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role: role || 'operator',
            },
            select: { id: true, username: true, role: true, createdAt: true }
        });
        res.json(user);
    }
    catch (error) {
        console.error('Failed to create user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};
exports.createUser = createUser;
const updateUser = async (req, res) => {
    try {
        const id = req.params.id;
        const { username, password, role } = req.body;
        const updateData = { username, role };
        if (password) {
            updateData.password = await bcrypt_1.default.hash(password, 10);
        }
        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: { id: true, username: true, role: true, createdAt: true }
        });
        res.json(user);
    }
    catch (error) {
        console.error('Failed to update user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        const id = req.params.id;
        // Prevent deleting the last admin
        const adminCount = await prisma.user.count({ where: { role: 'admin' } });
        const userToDelete = await prisma.user.findUnique({ where: { id } });
        if (userToDelete?.role === 'admin' && adminCount <= 1) {
            return res.status(400).json({ error: 'Cannot delete the last admin user' });
        }
        await prisma.user.delete({ where: { id } });
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        console.error('Failed to delete user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
exports.deleteUser = deleteUser;
